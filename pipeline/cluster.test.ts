import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClusters, consensusTitle, dedupeMembers, distinctPublishers, weightedJaccard } from "./cluster.ts";
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

test("the aggregate headline is the one the coverage agrees on", () => {
  // The Tehran lights, shortened. The best-tier member used to take the
  // headline, which meant one outlet's kicker spoke for thirty-two write-ups.
  const members = [
    mk("On Cam: Mystery Lights Over Tehran Skies Sparks UFO Buzz; Drone, Aircraft Or Aliens?", "The Times of India", "press", 5),
    mk("Mysterious lights over Tehran spark UFO speculation", "Marksmen Daily", "press", 6),
    mk("Mysterious object over Tehran sparks UFO speculation", "NewsBytes", "press", 6),
    mk("Unexplained lights over Tehran fuel UFO speculation amid war", "Yahoo", "press", 7),
    mk("Mystery lights over Tehran revive Iran's 1976 UFO encounter", "ThePrint", "press", 7),
  ];
  assert.equal(consensusTitle(members).title, "Mysterious lights over Tehran spark UFO speculation");
  // What matters is that the kicker loses: "On Cam", the semicolon and the
  // three-way question are the part nobody else wrote.
  assert.notEqual(consensusTitle(members).publisher, "The Times of India");

  // Consensus decides between equals; it does not outrank them. A blog that
  // happens to phrase a wire story plainly does not speak for the wire.
  const withBlog = [...members, mk("Mysterious lights over Tehran spark UFO speculation today", "Some Blog", "unverified", 5)];
  assert.equal(consensusTitle(withBlog).tier, "press");

  // Nor does a shout, a redirect that cannot be resolved, or a roundup.
  const noisy = [
    mk("RAW: MYSTERY LIGHTS OVER TEHRAN", "Local 3", "press", 5),
    mk("Mystery lights over Tehran spark UFO claims", "Opaque Wire", "press", 5, { url_opaque: true }),
    mk("Mystery lights over Tehran spark UFO claims today", "Roundup Weekly", "press", 5, { flags: ["roundup"] }),
    mk("Mystery lights over Tehran spark UFO claims in Iran", "The Standard", "press", 6),
    mk("Mystery lights over Tehran spark UFO claims, say locals", "Evening News", "press", 6),
  ];
  const picked = consensusTitle(noisy);
  assert.ok(["The Standard", "Evening News"].includes(picked.publisher), picked.publisher);

  // Below three write-ups there is no consensus to find.
  const pair = [mk("Nessie spotted at Urquhart Bay", "BBC", "press", 3), mk("Loch Ness monster seen again", "Daily Star", "genre", 4)];
  assert.equal(consensusTitle(pair).publisher, "BBC");
});

test("a story that outlasts three days is still one story", () => {
  // The Pentagon's eighth UAP release ran 21-26 November. These two headlines
  // score 0.577 against a 0.30 threshold and are 124 hours apart; under the
  // old 72-hour pair window they were never compared, and the front page
  // carried the same vault twice, five places apart.
  const items = [
    ...filler(40),
    mk("Pentagon UFO files reveal secret underground bunker plans to store exotic material", "Howl.Link", "genre", 10),
    mk("New UFO files reveal Pentagon's plan for secret underground vault to keep exotic material", "Times of India", "press", 134),
  ];
  const clusters = buildClusters(items, { now });
  const joined = clusters.find((c) => c.items.length === 2 && /underground/i.test(c.title));
  assert.ok(joined, "the two write-ups belong to one cluster");

  // The window never overrides the span guard: beyond seven days they stay apart.
  const farApart = [
    ...filler(40),
    mk("Pentagon UFO files reveal secret underground bunker plans to store exotic material", "Howl.Link", "genre", 10),
    mk("New UFO files reveal Pentagon's plan for secret underground vault to keep exotic material", "Times of India", "press", 10 + 8 * 24),
  ];
  assert.ok(!buildClusters(farApart, { now }).some((c) => c.items.length === 2 && /underground/i.test(c.title)), "eight days apart is beyond the span");
});

test("a shared year is not a shared story", () => {
  // "Election 2026 Michigan" scored 0.31 against "Michigan Bigfoot and UFO
  // Sightings 2026 Reported This Year" on the live corpus and became the
  // headline of a sightings story. A year still weighs; it is not one of the
  // two shared words a match needs.
  const idf = new Map([["election", 5], ["2026", 3], ["michigan", 4], ["bigfoot", 4], ["ufo", 1], ["sighting", 1], ["year", 2]]);
  assert.equal(weightedJaccard(["election", "2026", "michigan"], ["michigan", "bigfoot", "ufo", "sighting", "2026", "year"], idf), 0);
  // Two real words still match, and the year they share still counts toward the score.
  const idf2 = new Map([["roswell", 4], ["debris", 4], ["1947", 3], ["museum", 3]]);
  assert.ok(weightedJaccard(["roswell", "debris", "1947"], ["roswell", "debris", "1947", "museum"], idf2) > 0.7);
});

test("a member whose headline names no beat neither titles the story nor files it", () => {
  // A Sasquatch Chronicles episode about near-death research put a Daily Mail
  // consciousness study on the Cryptids page: the feed declares cryptids, and
  // a cluster's beats were the union of every member's.
  const items = [
    ...filler(40),
    mk("Life after death mystery deepens as scientists find signs of consciousness in clinically dead patients", "Daily Mail", "genre", 5, { topics: ["fortean"] }),
    mk("New study finds signs of consciousness in clinically dead patients", "Sasquatch Chronicles", "press", 4, { topics: ["cryptids"], flags: ["weak-match"] }),
  ];
  const c = buildClusters(items, { now }).find((c) => /consciousness/.test(c.title))!;
  assert.equal(c.items.length, 2, "one story");
  assert.deepEqual(c.topics, ["fortean"]);
  assert.match(c.title, /^Life after death/, "the higher-tier member names no beat, so it does not speak for the group");

  // When no member names a beat, every member still counts.
  const unnamed = [
    ...filler(40),
    mk("New study finds signs of consciousness in clinically dead patients", "Sasquatch Chronicles", "press", 4, { topics: ["cryptids"], flags: ["weak-match"] }),
    mk("Study finds signs of consciousness in clinically dead patients", "Other Outlet", "genre", 3, { topics: ["fortean"], flags: ["weak-match"] }),
  ];
  const u = buildClusters(unnamed, { now }).find((c) => /consciousness/.test(c.title))!;
  assert.deepEqual(u.topics, ["cryptids", "fortean"]);
});
