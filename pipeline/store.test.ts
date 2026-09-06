import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ShardStore, mergeItem, serializeItems } from "./store.ts";
import { itemId, normalizeTitle } from "./text.ts";
import type { Item } from "./types.ts";

function mk(title: string, publisher: string, published_at: string, extra: Partial<Item> = {}): Item {
  const title_norm = normalizeTitle(title);
  return { id: itemId(title_norm, publisher), title, title_norm, url: "https://news.google.com/rss/articles/x", url_opaque: true, publisher, tier: "press", topics: ["ufo"], flags: [], published_at, first_seen_at: "2026-09-06T00:00:00.000Z", feed_id: "gn", ...extra };
}

test("upsert adds, folds re-sightings, and persists one shard per day in stable order", () => {
  const dir = mkdtempSync(join(tmpdir(), "paranews-store-"));
  const store = new ShardStore(dir);
  const a = mk("Pentagon seeks UFO records", "DefenseScoop", "2026-09-02T20:34:40.000Z");
  const b = mk("Bigfoot spotted in Maine", "WMTW", "2026-09-05T10:00:00.000Z");
  assert.equal(store.upsert(a), "added");
  assert.equal(store.upsert(b), "added");
  assert.equal(store.upsert({ ...a, first_seen_at: "2026-09-07T00:00:00.000Z" }), "unchanged", "identity fields are not overwritten");
  assert.equal(store.upsert({ ...a, topics: ["ufo", "fortean"], snippet: "A snippet that arrived on a later sighting of the story." }), "updated");
  assert.deepEqual(store.save(), ["2026-09-02", "2026-09-05"]);
  assert.deepEqual(readdirSync(dir).sort(), ["2026-09-02.json", "2026-09-05.json"]);

  const reloaded = new ShardStore(dir);
  reloaded.loadWindow(new Date("2026-09-06T12:00:00Z"), 30);
  const got = reloaded.get(a.id)!;
  assert.deepEqual(got.topics, ["ufo", "fortean"]);
  assert.equal(got.first_seen_at, a.first_seen_at);
  assert.match(got.snippet!, /later sighting/);
  assert.equal(reloaded.all().length, 2);

  // A second save with nothing dirty writes nothing.
  assert.deepEqual(reloaded.save(), []);
  const text = readFileSync(join(dir, "2026-09-02.json"), "utf8");
  assert.equal(text, serializeItems([got]));
  assert.ok(text.startsWith("[\n  {\"id\":"), "one item per line");
});

test("loadWindow only reads shards inside the window but upsert can still reach older ones", () => {
  const dir = mkdtempSync(join(tmpdir(), "paranews-store-"));
  const store = new ShardStore(dir);
  const old = mk("Old story", "X", "2026-06-01T00:00:00.000Z");
  store.upsert(old);
  store.save();
  const later = new ShardStore(dir);
  later.loadWindow(new Date("2026-09-06T12:00:00Z"), 30);
  assert.equal(later.all().length, 0);
  assert.equal(later.upsert({ ...old, snippet: "Now with a snippet that is long enough to count as one." }), "updated");
  assert.equal(later.upsert(old), "unchanged");
});

test("mergeItem swaps an opaque link for a resolvable one and unions topics/flags", () => {
  const existing = mk("Same story", "Yahoo", "2026-09-05T00:00:00.000Z");
  const incoming = mk("Same story", "Yahoo", "2026-09-05T01:00:00.000Z", { url: "https://news.yahoo.com/same-story", url_opaque: false, flags: ["entertainment"], image: "https://img/x.jpg" });
  const merged = mergeItem(existing, incoming);
  assert.equal(merged.url, "https://news.yahoo.com/same-story");
  assert.equal(merged.url_opaque, false);
  assert.equal(merged.published_at, existing.published_at);
  assert.deepEqual(merged.flags, ["entertainment"]);
  assert.equal(merged.image, "https://img/x.jpg");
  assert.equal(mergeItem(merged, incoming), merged, "idempotent");
});
