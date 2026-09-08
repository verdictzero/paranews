import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClusters } from "./cluster.ts";
import { HIDDEN_FLAGS, isVisible, refreshItems } from "./visibility.ts";
import { itemId, normalizeTitle } from "./text.ts";
import type { Cluster, Item, Tier } from "./types.ts";

const now = new Date("2026-09-06T12:00:00Z");

function mk(title: string, publisher: string, tier: Tier, feed_id: string, flags: Item["flags"] = []): Item {
  const title_norm = normalizeTitle(title);
  const at = new Date(now.getTime() - 3 * 3_600_000).toISOString();
  return { id: itemId(title_norm, publisher), title, title_norm, url: "https://x/", url_opaque: false, publisher, tier, topics: ["cryptids"], flags, published_at: at, first_seen_at: at, feed_id };
}

test("refreshItems recomputes from the current classifier and publisher lists", () => {
  const stale = mk("Wildman: Bigfoot will go John Wick in bloody revenge thriller", "JoBlo", "genre", "gn-cryptids-us");
  const wrong = mk("Paranormal group to host investigation at King Opera House", "KFSM", "press", "gn-ghosts-a-us", ["entertainment"]);
  const direct = mk("Can't get this out of my head", "r/Paranormal", "unverified", "reddit-paranormal", ["weak-match"]);
  const unknownFeed = mk("Antique appraisal fundraiser at the library", "Sentinel", "press", "gn-retired-query");
  const softHyphen = mk("Forgotten case of 'Willie' the cottage poltergeis\u00ADt", "Express", "genre", "gn-ghosts-a-gb", ["weak-match"]);
  const [a, b, c, d, e] = refreshItems([stale, wrong, direct, unknownFeed, softHyphen]);
  assert.deepEqual(e.flags, [], "invisible characters in stored titles are ignored");
  assert.deepEqual(a.flags, ["entertainment"], "headline and outlet both say film");
  assert.deepEqual(b.flags, [], "old false positive cleared");
  assert.deepEqual(c.flags, [], "direct feeds never get weak-match");
  assert.deepEqual(d.flags, ["weak-match"], "retired gn- feeds are still treated as searches");
  assert.equal(refreshItems([a])[0], a, "unchanged items are returned as-is");
});

test("weak matches and offbeat items are hidden; attractions are not", () => {
  assert.deepEqual([...HIDDEN_FLAGS].sort(), ["entertainment", "offbeat", "weak-match"]);
  const junk = mk("Neighbor reacts to Granville explosion killing two", "WSYX", "press", "gn-fortean-b-us");
  const ticker = mk("Procure Space ETF (NASDAQ: UFO) Share Price & Updates", "MarketBeat", "genre", "gn-ufo-us");
  const fair = mk("Madworld Haunted Attraction opens in Piedmont", "KJCT", "press", "gn-ghosts-b-us");
  const clusters = buildClusters(refreshItems([junk, ticker, fair]), { now });
  const find = (s: string): Cluster => clusters.find((c) => c.title.includes(s))!;
  assert.equal(isVisible(find("Granville")), false);
  assert.equal(isVisible(find("NASDAQ")), false);
  assert.equal(isVisible(find("Madworld")), true);
});

test("a cluster is hidden when at least half its members are entertainment, otherwise shown", () => {
  const film = [
    mk("Wildman: Bigfoot will go John Wick in bloody revenge thriller", "JoBlo", "genre", "gn-cryptids-us"),
    mk("Bigfoot gets his own John Wick-style revenge thriller with Wildman", "IMDb", "genre", "gn-cryptids-us"),
  ];
  const sighting = [
    mk("Sandra Bullock recalls bizarre UFO sighting that left her convinced aliens exist", "Entertainment Weekly", "press", "gn-ufo-us"),
    mk("Sandra Bullock recalls bizarre UFO sighting that left her convinced aliens exist", "Yahoo", "genre", "gn-ufo-us"),
    mk("Sandra Bullock recalls bizarre UFO sighting that left her convinced aliens exist", "BroBible", "genre", "gn-ufo-us"),
  ];
  const pair = [
    mk("UFO experiences might have connection with specific demonic possession cases, says expert Diana Pasulka", "AOL.com", "genre", "gn-ufo-us"),
    mk("UFO experiences might have connection with specific demonic possession cases, says expert Diana Pasulka", "Soap Central", "genre", "gn-ufo-us"),
  ];
  const clusters = buildClusters(refreshItems([...film, ...sighting, ...pair]), { now });
  const byTitle = (s: string): Cluster => clusters.find((c) => c.title.includes(s))!;
  assert.equal(isVisible(byTitle("Wildman")), false);
  assert.equal(isVisible(byTitle("Sandra Bullock")), true, "one entertainment outlet among three does not hide a real claim");
  assert.equal(isVisible(byTitle("Pasulka")), true, "one entertainment outlet among two is not a majority");
});
