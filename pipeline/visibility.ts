import { loadSources } from "./config.ts";
import { computeFlags } from "./normalize.ts";
import type { Cluster, Flag, Item } from "./types.ts";

/** Clusters carrying any of these flags are left out of the site entirely. */
export const HIDDEN_FLAGS: ReadonlySet<Flag> = new Set<Flag>(["entertainment"]);

export function isVisible(cluster: Cluster): boolean {
  return !cluster.flags.some((f) => HIDDEN_FLAGS.has(f));
}

/**
 * Recompute every item's flags with the current classifier and publisher lists.
 * The stored flags record what ingest saw; the site always uses fresh ones so
 * a classifier fix applies to the whole archive at the next build.
 */
export function refreshFlags(items: Item[]): Item[] {
  const kinds = new Map(loadSources().sources.map((s) => [s.id, s.kind]));
  return items.map((item) => {
    const kind = kinds.get(item.feed_id) ?? (item.feed_id.startsWith("gn-") ? "google-news" : "rss");
    const flags = computeFlags(item.title, item.publisher, kind === "google-news");
    return sameFlags(flags, item.flags) ? item : { ...item, flags };
  });
}

function sameFlags(a: Flag[], b: Flag[]): boolean {
  return a.length === b.length && a.every((f, i) => f === b[i]);
}
