import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClusters, dedupeMembers, distinctPublishers } from "./cluster.ts";
import { itemId, normalizeTitle } from "./text.ts";
import type { Item, Tier, Topic } from "./types.ts";

const now = new Date("2026-09-06T12:00:00Z");

function mk(title: string, publisher: string, tier: Tier, hoursAgo: number, opts: Partial<Item> = {}): Item {
  const title_norm = normalizeTitle(title);
  const published_at = new Date(now.getTime() - hoursAgo * 3_600_000).toISOString();
  return {
    id: itemId(title_norm, publisher),
    title,
    title_norm,
    url: opts.url ?? `https://${publisher.toLowerCase().replace(/\W+/g, "")}.example/${title_norm.replace(/ /g, "-")}`,
    url_opaque: opts.url_opaque ?? false,
    publisher,
    tier,
    topics: opts.topics ?? (["ufo"] as Topic[]),
    flags: opts.flags ?? [],
    published_at,
    first_seen_at: published_at,
    feed_id: "test",
    ...opts,
  };
}

/** Background corpus so "ufo" and "sighting" are common while each filler keeps two unique tokens. */
function filler(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => mk(`UFO sighting reported over Township${i} near Ridge${i}`, `Outlet ${i}`, "genre", 200 + i));
}

test("identical headlines across outlets form one cluster with one write-up", () => {
  const items = [
    ...filler(30),
    mk("Geek Week PDX returns with city-wide festival & 'Sneak Sasquatch Art Hunt'", "KPTV", "press", 30),
    mk("Geek Week PDX returns with city-wide festival & 'Sneak Sasquatch Art Hunt'", "kptv.com", "genre", 30),
    mk("Geek Week PDX returns with city-wide festival & 'Sneak Sasquatch Art Hunt'", "WCTV", "press", 31),
  ];
  const c = buildClusters(items, { now }).find((c) => c.title.startsWith("Geek Week"))!;
  assert.equal(c.items.length, 3, "syndicated copies merged");
  assert.deepEqual([...c.publishers].sort(), ["KPTV", "WCTV"], "aliases folded, display name preferred");
  assert.equal(c.corroboration, 1, "one headline group counts as one independent write-up");
  assert.equal(c.tier, "press");
});

test("different stories that share only genre words stay apart", () => {
  const items = [...filler(30), mk("UFO sighting reported in Texas", "KXAN", "press", 5), mk("UFO sighting reported in Ohio", "WBNS", "press", 6)];
  const clusters = buildClusters(items, { now });
  const texas = clusters.find((c) => c.title.includes("Texas"))!;
  assert.equal(texas.items.length, 1);
});

test("paraphrased coverage of one story merges when rare tokens overlap", () => {
  const items = [
    ...filler(30),
    mk("Pentagon seeks access to vast private UFO records collection", "DefenseScoop", "press", 4),
    mk("Pentagon wants access to private UFO archive, records show", "NewsNation", "press", 3),
  ];
  const clusters = buildClusters(items, { now });
  const c = clusters.find((c) => c.title.startsWith("Pentagon"))!;
  assert.equal(c.items.length, 2);
  assert.equal(c.corroboration, 2, "two distinct press headlines");
  assert.deepEqual([...c.publishers].sort(), ["DefenseScoop", "NewsNation"]);
});

test("same headline far apart in time is not the same story", () => {
  const items = [...filler(30), mk("Mysterious lights spotted over Cumbria", "Cumbria Crack", "press", 2), mk("Mysterious lights spotted over Cumbria", "Cumbria Crack", "press", 24 * 20)];
  const clusters = buildClusters(items, { now });
  assert.equal(clusters.filter((c) => c.title.includes("Cumbria")).length, 2);
});

test("cluster fields: id from earliest item, primary prefers a resolvable link, topics unioned, flags by majority", () => {
  const a = mk("Wildman: Bigfoot will go John Wick in bloody revenge thriller", "JoBlo", "genre", 40, { url: "https://news.google.com/rss/articles/x", url_opaque: true, topics: ["cryptids"], flags: ["entertainment"] });
  const b = mk("'Wildman' pits Bigfoot against hunters in John Wick-style revenge thriller", "Yardbarker", "genre", 36, { topics: ["cryptids", "fortean"], flags: ["entertainment"] });
  const [c] = buildClusters([...filler(30), a, b], { now }).filter((c) => c.items.length === 2);
  assert.ok(c);
  assert.equal(c.id, a.id, "cluster id comes from the earliest member");
  assert.equal(c.primary, b.id, "primary prefers a resolvable link");
  assert.equal(c.title, b.title, "title follows the primary");
  assert.deepEqual(c.topics, ["cryptids", "fortean"]);
  assert.deepEqual(c.flags, ["entertainment"]);
  assert.equal(c.first_published, a.published_at);
  assert.equal(c.latest_published, b.published_at);
});

test("a readable headline beats a newer broadcast slug for the cluster title", () => {
  const slug = mk("RAW: SD: HISTORIC HOTEL/NOMINATED BEST HAUNTED HOTEL", "Local 3 News", "press", 2, { topics: ["ghosts"] });
  const good = mk("Historic Hotel Alex Johnson nominated for 'Best Haunted Hotel' in national contest", "KOTA", "press", 9, { topics: ["ghosts"] });
  const c = buildClusters([...filler(30), slug, good], { now }).find((c) => c.items.length === 2)!;
  assert.ok(c, "slug and headline merged");
  assert.equal(c.title, good.title);
  assert.equal(c.primary, good.id);
});

test("distinctPublishers prefers the non-domain spelling regardless of order", () => {
  const items = [mk("x y z", "cbsnews.com", "genre", 1), mk("x y z", "CBS News", "press", 1)];
  assert.deepEqual(distinctPublishers(items), ["CBS News"]);
});

test("the primary link prefers the display-name alias and duplicate alias rows collapse", () => {
  const domain = mk("Bigfoot revenge thriller Wildman picked up by Badlands", "hollywoodreporter.com", "press", 3, { url: "https://news.google.com/rss/articles/a", url_opaque: true });
  const named = mk("Bigfoot revenge thriller Wildman picked up by Badlands", "The Hollywood Reporter", "press", 3, { url: "https://news.google.com/rss/articles/b", url_opaque: true });
  const other = mk("Badlands acquires Bigfoot thriller Wildman", "IMDb", "genre", 2, { url: "https://news.google.com/rss/articles/c", url_opaque: true });
  const c = buildClusters([...filler(30), domain, named, other], { now }).find((c) => c.items.length === 3)!;
  assert.ok(c);
  assert.equal(c.primary, named.id);
  assert.deepEqual(c.publishers, ["The Hollywood Reporter", "IMDb"]);
  assert.deepEqual(dedupeMembers([named, domain, other]).map((m) => m.publisher), ["The Hollywood Reporter", "IMDb"]);
});
