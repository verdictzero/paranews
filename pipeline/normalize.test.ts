import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEntry, parseDate } from "./normalize.ts";
import type { SourceConfig } from "./types.ts";

const now = new Date("2026-09-06T12:00:00Z");
const gn: SourceConfig = { id: "gn-ufo-us", name: "Google News · UFO", kind: "google-news", query: "ufo", topics: ["ufo"], enabled: true };
const debrief: SourceConfig = { id: "the-debrief", name: "The Debrief", kind: "rss", url: "https://thedebrief.org/feed/", tier: "genre", topics: "auto", enabled: true };
const grail: SourceConfig = { ...debrief, id: "daily-grail", name: "The Daily Grail", default_topic: "fortean" };

test("Google News item: publisher from source, suffix stripped, opaque link, echo snippet dropped, tier from lookup", () => {
  const item = normalizeEntry(
    {
      title: "Pentagon seeks access to vast private UFO records collection - DefenseScoop",
      link: "https://news.google.com/rss/articles/CBMiabc?oc=5",
      published: "Wed, 02 Sep 2026 20:34:40 GMT",
      summary: '<a href="x">Pentagon seeks access to vast private UFO records collection</a>&nbsp;&nbsp;<font color="#6f6f6f">DefenseScoop</font>',
      source: { name: "DefenseScoop", url: "https://defensescoop.com" },
    },
    gn,
    now,
  )!;
  assert.equal(item.title, "Pentagon seeks access to vast private UFO records collection");
  assert.equal(item.publisher, "DefenseScoop");
  assert.equal(item.publisher_url, "https://defensescoop.com");
  assert.equal(item.tier, "press");
  assert.equal(item.url_opaque, true);
  assert.equal(item.snippet, undefined);
  assert.deepEqual(item.topics, ["ufo"]);
  assert.equal(item.published_at, "2026-09-02T20:34:40.000Z");
  assert.equal(item.first_seen_at, now.toISOString());
});

test("unknown Google News publishers fall back to the configured default tier; patterns catch call signs", () => {
  const mk = (name: string) => normalizeEntry({ title: `Some UFO story - ${name}`, link: "https://news.google.com/rss/articles/x", source: { name } }, gn, now)!;
  assert.equal(mk("KLAS 8 News Now").tier, "press");
  assert.equal(mk("Avi Loeb – Medium").tier, "unverified");
  assert.equal(mk("randomsite.example").tier, "genre");
});

test("auto sources keep only classified headlines unless a default topic exists", () => {
  const off = normalizeEntry({ title: "Conflict in the Final Frontier: preparing for war", link: "https://thedebrief.org/a/" }, debrief, now);
  assert.equal(off, undefined);
  const on = normalizeEntry({ title: "Scientists just analyzed 100 UAP videos", link: "https://thedebrief.org/b/", content: "<p>A body long enough to become a snippet for the story page.</p>" }, debrief, now)!;
  assert.deepEqual(on.topics, ["ufo"]);
  assert.equal(on.tier, "genre");
  assert.equal(on.url_opaque, false);
  assert.equal(on.snippet, "A body long enough to become a snippet for the story page.");
  const dflt = normalizeEntry({ title: "News Briefs 03-09-2026", link: "https://www.dailygrail.com/x/" }, grail, now)!;
  assert.deepEqual(dflt.topics, ["fortean"]);
});

test("feed snippets that merely echo the headline are dropped, echo prefixes are trimmed", () => {
  const echo = normalizeEntry({ title: "It’s ‘John Wick’ Meets Bigfoot", link: "https://thedebrief.org/x/", summary: "It's 'John Wick' Meets Bigfoot The Debrief" }, debrief, now)!;
  assert.equal(echo.snippet, undefined);
  const prefixed = normalizeEntry({ title: "Bigfoot spotted near Fresno", link: "https://thedebrief.org/y/", summary: "Bigfoot spotted near Fresno — residents describe a tall figure crossing the road at dusk on Tuesday." }, debrief, now)!;
  assert.equal(prefixed.snippet, "— residents describe a tall figure crossing the road at dusk on Tuesday.");
});

test("fixed-topic sources gain secondary topics from the headline", () => {
  const item = normalizeEntry({ title: "UFO experiences linked to demonic possession, says expert - AOL", link: "https://news.google.com/rss/articles/y", source: { name: "AOL" } }, gn, now)!;
  assert.deepEqual(item.topics, ["ufo", "ghosts"]);
});

test("beat searches whose headline names no beat keyword get the weak-match flag", () => {
  const weak = normalizeEntry({ title: "Ashby Library hosts Antique Appraisal Fundraiser Sept. 13 - Sentinel", link: "https://news.google.com/rss/articles/z", source: { name: "Sentinel" } }, gn, now)!;
  assert.deepEqual(weak.flags, ["weak-match"]);
  const strong = normalizeEntry({ title: "Pilots report mysterious lights over Oregon - KGW", link: "https://news.google.com/rss/articles/z", source: { name: "KGW" } }, gn, now)!;
  assert.deepEqual(strong.flags, []);
  const reddit: SourceConfig = { id: "reddit-paranormal", name: "r/Paranormal", kind: "rss", url: "https://www.reddit.com/r/Paranormal/top/.rss", tier: "unverified", topics: ["ghosts"], enabled: true };
  assert.deepEqual(normalizeEntry({ title: "Can't get this out of my head", link: "https://www.reddit.com/r/Paranormal/comments/x/" }, reddit, now)!.flags, [], "direct feeds are on-beat by construction");
  assert.equal(normalizeEntry({ title: "Mushoku Tensei: Jobless Reincarnation III ‒ Episode 10 - ANN", link: "https://news.google.com/rss/articles/z", source: { name: "ANN" } }, gn, now), undefined);
});

test("junk, short and non-http entries are dropped", () => {
  assert.equal(normalizeEntry({ title: "MY LAST TIME PLAYING ROBLOX.. Ufo Files (sP0cjhR31l)", link: "https://x.com/" }, gn, now), undefined);
  assert.equal(normalizeEntry({ title: "UFO", link: "https://x.com/" }, gn, now), undefined);
  assert.equal(normalizeEntry({ title: "Sasquatch - Maryville Forum", link: "https://x.com/", source: { name: "Maryville Forum" } }, gn, now), undefined, "captions are not stories");
  assert.equal(normalizeEntry({ title: "Bigfoot frame - Tulsa World", link: "https://x.com/", source: { name: "Tulsa World" } }, gn, now), undefined);
  assert.ok(normalizeEntry({ title: "UFO spotted over Reno - KOLO", link: "https://x.com/", source: { name: "KOLO" } }, gn, now));
  assert.equal(normalizeEntry({ title: "A perfectly fine UFO headline", link: "ftp://x" }, gn, now), undefined);
});

test("parseDate collapses missing, garbage and future dates to now", () => {
  assert.equal(parseDate(undefined, now), now.toISOString());
  assert.equal(parseDate("yesterday-ish", now), now.toISOString());
  assert.equal(parseDate("2027-01-01T00:00:00Z", now), now.toISOString());
  assert.equal(parseDate("Sat, 05 Sep 2026 10:00:00 GMT", now), "2026-09-05T10:00:00.000Z");
});
