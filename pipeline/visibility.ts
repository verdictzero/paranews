import { loadSources } from "./config.ts";
import { computeFlags } from "./normalize.ts";
import { cleanTitle, normalizeTitle, stripPublisherSuffix } from "./text.ts";
import type { Cluster, Flag, Item } from "./types.ts";

/**
 * Clusters carrying any of these flags are left out of the site entirely:
 * entertainment (fiction and its promotion), offbeat (a beat word used as a
 * ticker, product or team name) and weak-match (a beat search matched the
 * article body but the headline names nothing from any beat — in practice
 * explosions, crashes, obituaries and game guides). Attractions stay visible.
 */
export const HIDDEN_FLAGS: ReadonlySet<Flag> = new Set<Flag>(["entertainment", "offbeat", "weak-match"]);

export function isVisible(cluster: Cluster): boolean {
  return !cluster.flags.some((f) => HIDDEN_FLAGS.has(f));
}

/**
 * Re-derive every item's title and flags with the current code. What is stored
 * is what ingest saw at the time; the site always shows freshly derived values,
 * so a classifier or title fix applies to the whole archive at the next build
 * without rewriting a single stored record.
 *
 * The id is never recomputed. Identity is fixed at first sighting, so a title
 * fix can never split a story or orphan its reader copy.
 */
export function refreshItems(items: Item[]): Item[] {
  const kinds = new Map(loadSources().sources.map((s) => [s.id, s.kind]));
  return items.map((item) => {
    const kind = kinds.get(item.feed_id) ?? (item.feed_id.startsWith("gn-") ? "google-news" : "rss");
    const fromEntry = kind === "google-news" || kind === "reddit";
    // Older items may carry invisible characters, or a publisher suffix that the
    // stripper of the day could not see past.
    let title = cleanTitle(item.title);
    if (fromEntry) title = stripPublisherSuffix(title, item.publisher);
    const flags = computeFlags(title, item.publisher, kind === "google-news");
    if (title === item.title && sameFlags(flags, item.flags)) return item;
    return { ...item, title, title_norm: normalizeTitle(title), flags };
  });
}

function sameFlags(a: Flag[], b: Flag[]): boolean {
  return a.length === b.length && a.every((f, i) => f === b[i]);
}
