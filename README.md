# Paranews

A self-updating news wire for the paranormal: UFO/UAP, hauntings, cryptids and high strangeness. It reads ~27 feeds every half hour, folds the same story from different outlets into one entry, grades every entry by *who* published it, ranks the result and publishes a static site to GitHub Pages. It links out and writes nothing of its own — no article text, no generated summaries, no language model anywhere in the pipeline.

**Live site:** https://verdictzero.github.io/paranews/ (after the one-time setup below)

## How it works

```
GitHub Actions cron (*/30)
  fetch ─► normalize ─► store (data/items/YYYY-MM-DD.json, committed)
                                     │
                          astro build ─► cluster ─► rank ─► static HTML ─► GitHub Pages
```

- **Items are the source of truth, clusters are derived.** Every feed entry ever seen is committed as JSON, one file per publication day, one item per line, sorted by id. Git history *is* the archive: `git show <sha>:data/items/2026-09-05.json` reconstructs any day. Clusters and rankings are recomputed at build time, so improving the grouping never requires touching data.
- **Google News searches are the backbone.** One RSS search per beat (US and UK editions) returns ~100 fresh headlines with the publisher name — no auth, no bot walls. Direct feeds from genre outlets, science desks and subreddits add real links, snippets and personality.
- **Grouping is lexical.** Headlines become bags of stemmed words weighted by rarity across the current month (IDF-weighted Jaccard). Sharing "ufo" and "sighting" means nothing; sharing "pentagon", "private" and "archive" means a lot. Union-find with a 72-hour pair window and a 7-day span guard. The 0.3 threshold was chosen against live data: every extra merge between 0.5 and 0.3 was a genuine match.
- **Tiers are a lookup, not a judgement.** `official` (wires, government, journals) → `press` (mainstream and local newsrooms) → `genre` (genre press, tabloids, enthusiast sites) → `unverified` (social, single-witness blogs). Assigned per publisher from `config/sources.yml`, never from the story text. Deterministic and auditable.
- **Ranking:** `Σ tier weight per independent write-up × (1 + ln write-ups) ÷ (hours since latest coverage + 6)`. Twenty affiliates running one syndicated headline count as one write-up. Film/TV/merch and Halloween-attraction stories are flagged and demoted, never hidden.
- **Source health:** per-feed ETag/Last-Modified caching, browser user agent (several publishers refuse anything else), three consecutive failures → quarantine → daily re-probe → auto-heal, and a `source-health` GitHub issue when a feed is quarantined.

## Repository layout

```
config/sources.yml        feed registry, publisher → tier table, retired feeds with notes
pipeline/                 pure modules: feeds, normalize, classify, store, health, cluster, rank
pipeline/*.test.ts        node:test suites
scripts/ingest.ts         poll sources → data/  (npm run ingest)
scripts/clusters.ts       dump clusters to .cache/clusters.json for inspection (npm run clusters)
scripts/quarantine-report.ts  issue payloads for newly quarantined sources
data/items/               committed archive, one file per UTC publication day
data/health.json          per-source status, validators, last error
data/meta.json            last run time and counts
src/                      Astro site: front page, beat pages, story pages, about, sources, rss.xml, sitemap
.github/workflows/update.yml   schedule → test → ingest → commit → build → deploy
.github/workflows/ci.yml       test + typecheck + build on pull requests
```

## One-time setup

1. Merge this branch into `main` (the schedule only runs on the default branch).
2. Settings → Pages → **Source: GitHub Actions**. The workflow also tries to enable this itself (`actions/configure-pages` with `enablement: true`); if the first run fails at "Configure Pages", flip the setting and re-run.
3. Actions → *Update site* → **Run workflow** for an immediate first publish. After that it runs itself.

**Custom domain?** Add it under Settings → Pages. The workflow reads the origin and base path GitHub reports, so nothing in the code changes.

**Private repository?** Every run costs ~2 Actions minutes; 48 runs a day is ~3,000 minutes a month, above the 2,000 free for private repos. Change the cron to `0 * * * *` (hourly). Public repositories have unlimited minutes.

**Schedule caveats:** GitHub runs cron best-effort (5–15 minutes of drift is normal) and disables schedules after 60 days without repository activity. The data commits normally keep it alive; if the schedule ever stops, re-enable it under Actions.

## Local development

```sh
npm ci
npm run ingest      # poll every enabled source into data/ (idempotent; safe to re-run)
npm run clusters    # print the ranked clusters, write .cache/clusters.json
npm run dev         # Astro dev server on http://localhost:4321/paranews/
npm test
npm run typecheck
npm run build       # dist/
```

`npm run clusters -- --threshold 0.35` tries a different similarity cutoff without touching data. Node ≥ 22.18 runs the TypeScript directly (no build step, no `tsx`).

## Editing sources

Everything editorial lives in `config/sources.yml`:

- **Add a feed:** an entry with `kind: rss`, a `url`, a `tier`, and either fixed `topics: [ufo]` or `topics: auto` (headline classifier decides; add `default_topic` to keep unmatched items, omit it to drop them — the right choice for a general science feed).
- **Add a Google News beat:** `kind: google-news`, `edition: US|GB`, and a `query` of **at most 190 characters**. Google silently drops the `when:7d` recency operator on long queries and returns years-old results; validation refuses longer queries. Split a beat into several short queries instead.
- **Fix a tier:** add the publisher's name to the right list under `publishers:`. Exact names win over the regex patterns (local call signs, newspaper naming conventions); anything unknown defaults to `genre`.
- **Retire a feed:** `enabled: false` plus a `note:` saying why, so the next person doesn't rediscover the same dead path.

Query words that looked reasonable and were not: `haunted`/`haunting` (metaphors, LEGO sets), `yeti` (coolers), `dogman` (children's books), bare `loch ness` (tourism), `jersey devil` (NHL), `skinwalker ranch`/`ancient aliens`/`bermuda triangle` (TV promos). They are documented in the registry.

## Tuning

- Similarity threshold, pair window and span guard: `pipeline/cluster.ts` (`DEFAULTS`).
- Tier weights, flag penalties and the age offset: `pipeline/rank.ts`.
- Topic and flag keyword rules: `pipeline/classify.ts` — precision over recall; a wrong beat is worse than a missed one.
- Window (30 days on site), max age at ingest (45 days), quarantine threshold (3), re-probe interval (24 h): `pipeline/config.ts`, `scripts/ingest.ts`, `pipeline/health.ts`.

## What it deliberately doesn't do

- Republish article bodies or images. Snippets are the feeds' own descriptions, capped at 300 characters; image URLs are stored but not displayed.
- Scrape sighting databases. NUFORC's terms forbid scraping and redistribution; that data is available by asking them, not by crawling.
- Resolve Google News links server-side. They are opaque redirects that only resolve in a browser, so identity is `hash(headline, publisher)`, and a cluster's primary link prefers a direct feed's real URL when one exists.
- Judge claims. The tier says what kind of outlet published something; nothing here says whether it happened.
