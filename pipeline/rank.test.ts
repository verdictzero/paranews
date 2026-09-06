import { test } from "node:test";
import assert from "node:assert/strict";
import { FLAG_PENALTY, interleave, scoreCluster } from "./rank.ts";
import { itemId, normalizeTitle } from "./text.ts";
import type { Cluster, Item, Tier, Topic } from "./types.ts";

const now = new Date("2026-09-06T12:00:00Z");
const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000).toISOString();

function mk(title: string, publisher: string, tier: Tier, hoursAgo: number): Item {
  const title_norm = normalizeTitle(title);
  return { id: itemId(title_norm, publisher), title, title_norm, url: "https://x/", url_opaque: false, publisher, tier, topics: ["ufo"], flags: [], published_at: at(hoursAgo), first_seen_at: at(hoursAgo), feed_id: "t" };
}

test("twenty syndicated copies score below three independent press write-ups", () => {
  const syndicated = Array.from({ length: 20 }, (_, i) => mk("Sasquatch art hunt returns", `Station ${i}`, "press", 10));
  const independent = [mk("Pentagon seeks UFO records", "A", "press", 10), mk("Pentagon wants private UFO archive", "B", "press", 10), mk("Pentagon asks for UFO files", "C", "press", 10)];
  assert.ok(scoreCluster(syndicated, [], at(10), now) < scoreCluster(independent, [], at(10), now));
});

test("fresher beats older at equal weight; press beats unverified when equally fresh", () => {
  assert.ok(scoreCluster([mk("a b c", "P", "press", 2)], [], at(2), now) > scoreCluster([mk("a b c", "P", "press", 30)], [], at(30), now));
  assert.ok(scoreCluster([mk("a b c", "P", "press", 2)], [], at(2), now) > scoreCluster([mk("a b c", "R", "unverified", 2)], [], at(2), now));
});

test("flags demote multiplicatively", () => {
  const m = [mk("a b c", "P", "press", 2)];
  const base = scoreCluster(m, [], at(2), now);
  assert.ok(Math.abs(scoreCluster(m, ["entertainment"], at(2), now) - base * FLAG_PENALTY.entertainment) < 1e-9);
  assert.ok(Math.abs(scoreCluster(m, ["entertainment", "attraction"], at(2), now) - base * FLAG_PENALTY.entertainment * FLAG_PENALTY.attraction) < 1e-9);
  assert.ok(FLAG_PENALTY.entertainment < FLAG_PENALTY["weak-match"] && FLAG_PENALTY["weak-match"] < FLAG_PENALTY.attraction);
});

test("interleave never runs more than two of one topic in a row", () => {
  const c = (id: string, topic: Topic, score: number): Cluster => ({ id, title: id, primary: id, items: [id], publishers: ["x"], tier: "press", corroboration: 1, topics: [topic], flags: [], first_published: at(1), latest_published: at(1), score });
  const input = [c("1", "ufo", 9), c("2", "ufo", 8), c("3", "ufo", 7), c("4", "ufo", 6), c("5", "ghosts", 5), c("6", "cryptids", 4), c("7", "ufo", 3)];
  const out = interleave(input).map((x) => `${x.id}:${x.topics[0]}`);
  assert.deepEqual(out, ["1:ufo", "2:ufo", "5:ghosts", "3:ufo", "4:ufo", "6:cryptids", "7:ufo"]);
});
