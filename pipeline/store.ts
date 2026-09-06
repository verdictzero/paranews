import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { ITEMS_DIR, WINDOW_DAYS } from "./config.ts";
import type { Item } from "./types.ts";
import { sortTopics } from "./normalize.ts";

/**
 * Items live in one JSON file per UTC publication day, one item per line,
 * sorted by id. That keeps git diffs to "one line per new story" and makes a
 * no-op ingest produce no diff at all.
 */
export class ShardStore {
  private shards = new Map<string, Map<string, Item>>();
  private index = new Map<string, string>();
  private dirty = new Set<string>();
  private dir: string;

  constructor(dir: string = ITEMS_DIR) {
    this.dir = dir;
  }

  static dateOf(iso: string): string {
    return iso.slice(0, 10);
  }

  private path(date: string): string {
    return `${this.dir}/${date}.json`;
  }

  load(date: string): Map<string, Item> {
    let shard = this.shards.get(date);
    if (shard) return shard;
    shard = new Map();
    const p = this.path(date);
    if (existsSync(p)) {
      for (const item of JSON.parse(readFileSync(p, "utf8")) as Item[]) {
        shard.set(item.id, item);
        this.index.set(item.id, date);
      }
    }
    this.shards.set(date, shard);
    return shard;
  }

  /** Load every shard whose day falls inside the rolling window ending today. */
  loadWindow(now: Date, days = WINDOW_DAYS): void {
    const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
    for (const date of this.availableDates()) if (date >= cutoff) this.load(date);
  }

  availableDates(): string[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort();
  }

  get(id: string): Item | undefined {
    const date = this.index.get(id);
    return date ? this.shards.get(date)?.get(id) : undefined;
  }

  /** Insert a new item or fold a re-sighting into the existing record. */
  upsert(incoming: Item): "added" | "updated" | "unchanged" {
    // Make sure the shard for the incoming day is loaded so a re-sighting outside
    // the window still lands on its existing record instead of a duplicate.
    this.load(ShardStore.dateOf(incoming.published_at));
    const existing = this.get(incoming.id);
    if (!existing) {
      const date = ShardStore.dateOf(incoming.published_at);
      this.load(date).set(incoming.id, incoming);
      this.index.set(incoming.id, date);
      this.dirty.add(date);
      return "added";
    }
    const merged = mergeItem(existing, incoming);
    if (merged === existing) return "unchanged";
    const date = this.index.get(incoming.id)!;
    this.shards.get(date)!.set(incoming.id, merged);
    this.dirty.add(date);
    return "updated";
  }

  /** Every loaded item. Call loadWindow() first for the site's working set. */
  all(): Item[] {
    const out: Item[] = [];
    for (const shard of this.shards.values()) out.push(...shard.values());
    return out;
  }

  /** Write changed shards. Returns the dates written. */
  save(): string[] {
    mkdirSync(this.dir, { recursive: true });
    const written: string[] = [];
    for (const date of [...this.dirty].sort()) {
      const items = [...this.shards.get(date)!.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
      writeFileSync(this.path(date), serializeItems(items));
      written.push(date);
    }
    this.dirty.clear();
    return written;
  }
}

/**
 * First sighting wins for identity fields (title, date, tier); later sightings
 * can only add topics/flags or fill a missing snippet/image. Returns the same
 * object when nothing changed so callers can skip the write.
 */
export function mergeItem(existing: Item, incoming: Item): Item {
  const topics = sortTopics([...existing.topics, ...incoming.topics]);
  const flags = [...new Set([...existing.flags, ...incoming.flags])].sort();
  const snippet = existing.snippet ?? incoming.snippet;
  const image = existing.image ?? incoming.image;
  // Prefer a resolvable link over an opaque Google News redirect.
  const url = existing.url_opaque && !incoming.url_opaque ? incoming.url : existing.url;
  const url_opaque = existing.url_opaque && !incoming.url_opaque ? false : existing.url_opaque;
  const publisher_url = existing.publisher_url ?? incoming.publisher_url;
  const same =
    topics.length === existing.topics.length &&
    flags.length === existing.flags.length &&
    snippet === existing.snippet &&
    image === existing.image &&
    url === existing.url &&
    publisher_url === existing.publisher_url;
  if (same) return existing;
  return { ...existing, topics, flags, snippet, image, url, url_opaque, publisher_url };
}

const ITEM_KEYS: (keyof Item)[] = [
  "id", "title", "title_norm", "url", "url_opaque", "publisher", "publisher_url", "tier",
  "topics", "flags", "published_at", "first_seen_at", "feed_id", "snippet", "image",
];

/** One item per line, fixed key order: stable output for clean diffs. */
export function serializeItems(items: Item[]): string {
  const lines = items.map((item) => {
    const ordered: Record<string, unknown> = {};
    for (const k of ITEM_KEYS) if (item[k] !== undefined) ordered[k] = item[k];
    return "  " + JSON.stringify(ordered);
  });
  return `[\n${lines.join(",\n")}\n]\n`;
}
