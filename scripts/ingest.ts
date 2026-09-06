/**
 * Poll every enabled source, fold new items into data/items/, update
 * data/health.json and data/meta.json. Exit 1 only when every source failed
 * (no network) so a dead runner never quarantines the whole registry.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { CACHE_DIR, META_FILE, WINDOW_DAYS, loadSources, sourceUrl } from "../pipeline/config.ts";
import { fetchFeed } from "../pipeline/feeds.ts";
import { normalizeEntry } from "../pipeline/normalize.ts";
import { ShardStore } from "../pipeline/store.ts";
import { loadHealth, markDisabled, recordFailure, recordSuccess, saveHealth, shouldSkip } from "../pipeline/health.ts";
import type { MetaFile, SourceConfig } from "../pipeline/types.ts";

interface Outcome {
  id: string;
  ok: boolean;
  status: number;
  entries: number;
  kept: number;
  added: number;
  updated: number;
  note?: string;
}

/**
 * Feeds resurface years-old articles (Google News "when:7d" filters on index
 * time, not publication; long-tail blogs list their whole archive). Anything
 * older than this at first sighting is never news and is not stored.
 */
const MAX_AGE_DAYS = 45;

/** Minimum gap between two requests to the same host. Reddit punishes anything faster. */
const HOST_DELAY_MS: Record<string, number> = { "www.reddit.com": 6000 };
const DEFAULT_DELAY_MS = 800;

const now = new Date();
const oldestAccepted = new Date(now.getTime() - MAX_AGE_DAYS * 86_400_000).toISOString();
const health = loadHealth();
const store = new ShardStore();
store.loadWindow(now);
const windowCutoff = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
const inWindow = (): number => store.all().filter((i) => i.published_at >= windowCutoff).length;
const windowBefore = inWindow();

const { sources } = loadSources();
for (const s of sources) if (!s.enabled) markDisabled(health, s.id);
// Sources removed from the registry take their health records with them.
for (const id of Object.keys(health.sources)) if (!sources.some((s) => s.id === id)) delete health.sources[id];

const active = sources.filter((s) => s.enabled);
const skipped = active.filter((s) => shouldSkip(health, s.id, now));
const toFetch = active.filter((s) => !skipped.includes(s));

const byHost = new Map<string, SourceConfig[]>();
for (const s of toFetch) {
  const host = new URL(sourceUrl(s)).host;
  byHost.set(host, [...(byHost.get(host) ?? []), s]);
}

const outcomes: Outcome[] = [];
const newlyQuarantined: string[] = [];

async function runHost(host: string, list: SourceConfig[]): Promise<void> {
  for (let i = 0; i < list.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, HOST_DELAY_MS[host] ?? DEFAULT_DELAY_MS));
    outcomes.push(await runSource(list[i]));
  }
}

async function runSource(s: SourceConfig): Promise<Outcome> {
  const h = health.sources[s.id];
  const result = await fetchFeed(sourceUrl(s), { etag: h?.etag, lastModified: h?.last_modified });
  if (result.notModified) {
    recordSuccess(health, s.id, { status: 304, itemCount: 0, notModified: true }, now);
    return { id: s.id, ok: true, status: 304, entries: 0, kept: 0, added: 0, updated: 0, note: "not modified" };
  }
  if (result.error || (result.status === 200 && result.entries.length === 0)) {
    const err = result.error ?? "feed parsed but contained no entries";
    if (recordFailure(health, s.id, err, result.status, now)) newlyQuarantined.push(s.id);
    return { id: s.id, ok: false, status: result.status, entries: 0, kept: 0, added: 0, updated: 0, note: err };
  }
  let kept = 0;
  let added = 0;
  let updated = 0;
  let stale = 0;
  for (const entry of result.entries) {
    const item = normalizeEntry(entry, s, now);
    if (!item) continue;
    if (item.published_at < oldestAccepted && !store.get(item.id)) {
      stale++;
      continue;
    }
    kept++;
    const r = store.upsert(item);
    if (r === "added") added++;
    else if (r === "updated") updated++;
  }
  recordSuccess(health, s.id, { status: result.status, itemCount: kept, etag: result.etag, lastModified: result.lastModified }, now);
  return { id: s.id, ok: true, status: result.status, entries: result.entries.length, kept, added, updated, note: stale ? `${stale} stale skipped` : undefined };
}

await Promise.all([...byHost].map(([host, list]) => runHost(host, list)));

const failures = outcomes.filter((o) => !o.ok);
if (toFetch.length > 0 && failures.length === toFetch.length) {
  console.error(`ingest: every source failed (${failures.length}/${toFetch.length}); leaving data and health untouched`);
  for (const o of failures) console.error(`  ${o.id}: ${o.note}`);
  process.exit(1);
}

const written = store.save();
saveHealth(health);

const totalItems = (() => {
  const full = new ShardStore();
  for (const d of full.availableDates()) full.load(d);
  return full.all().length;
})();
const totalAdded = outcomes.reduce((n, o) => n + o.added, 0);
const meta: MetaFile = { last_run_at: now.toISOString(), last_run_new_items: totalAdded, total_items: totalItems };
writeFileSync(META_FILE, JSON.stringify(meta, null, 2) + "\n");

mkdirSync(CACHE_DIR, { recursive: true });
writeFileSync(`${CACHE_DIR}/quarantined.json`, JSON.stringify(newlyQuarantined) + "\n");
writeFileSync(`${CACHE_DIR}/ingest-summary.json`, JSON.stringify({ at: now.toISOString(), outcomes, skipped: skipped.map((s) => s.id) }, null, 2) + "\n");

outcomes.sort((a, b) => a.id.localeCompare(b.id));
console.log(`source                    status entries kept  +new  ~upd  note`);
for (const o of outcomes) {
  console.log(
    `${o.id.padEnd(25)} ${String(o.status).padStart(6)} ${String(o.entries).padStart(7)} ${String(o.kept).padStart(4)} ${String(o.added).padStart(5)} ${String(o.updated).padStart(5)}  ${o.ok ? o.note ?? "" : "FAIL " + o.note}`,
  );
}
for (const s of skipped) console.log(`${s.id.padEnd(25)}  skipped (quarantined; next probe in <24h)`);
console.log(
  `\n${outcomes.length} sources polled, ${failures.length} failed, ${newlyQuarantined.length} newly quarantined. ` +
    `+${totalAdded} new items (window ${windowBefore} -> ${inWindow()}, archive ${totalItems}). Wrote ${written.length} shard(s).`,
);
