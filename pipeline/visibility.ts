import { loadSources } from "./config.ts";
import { computeFlags, sortTopics } from "./normalize.ts";
import { classifyTopics } from "./classify.ts";
import { cleanTitle, normalizeTitle, stripPublisherSuffix } from "./text.ts";
import type { Cluster, Flag, Item } from "./types.ts";

/**
 * Clusters carrying any of these flags are left out of the site entirely:
 * entertainment (fiction and its promotion), offbeat (a beat word used as a
 * ticker, product or team name) and weak-match (a beat search matched the
 * article body but the headline names nothing from any beat — in practice
 * explosions, crashes, obituaries and game guides). Attractions stay visible.
 */
export const HIDDEN_FLAGS: ReadonlySet<Flag> = new Set<Flag>(["entertainment", "offbeat", "weak-match", "gathering"]);

export function isVisible(cluster: Cluster): boolean {
  return !cluster.flags.some((f) => HIDDEN_FLAGS.has(f));
}

/**
 * Re-derive every item's title, beats and flags with the current code. What is
 * stored is what ingest saw at the time; the site always shows freshly derived
 * values, so a classifier or title fix applies to the whole archive at the next
 * build without rewriting a single stored record.
 *
 * The id is never recomputed. Identity is fixed at first sighting, so a title
 * fix can never split a story or orphan its reader copy.
 */
export function refreshItems(items: Item[]): Item[] {
  const sources = new Map(loadSources().sources.map((s) => [s.id, s]));
  return items.map((item) => {
    const source = sources.get(item.feed_id);
    const kind = source?.kind ?? (item.feed_id.startsWith("gn-") ? "google-news" : "rss");
    const fromEntry = kind === "google-news" || kind === "reddit";
    // Older items may carry invisible characters, or a publisher suffix that the
    // stripper of the day could not see past.
    let title = cleanTitle(item.title);
    if (fromEntry) title = stripPublisherSuffix(title, item.publisher);
    const flags = computeFlags(title, item.publisher);
    // Beats are re-derived too. A stored topic records only what the classifier
    // said the day the item arrived, so without this a tightened rule would
    // apply to new items alone and the archive would keep every old mistake.
    const classified = classifyTopics(title);
    const declared = !source || source.topics === "auto" ? (source?.default_topic ? [source.default_topic] : []) : sortTopics(source.topics);
    const topics = classified.length ? classified : declared.length ? declared : item.topics;
    if (title === item.title && same(flags, item.flags) && same(topics, item.topics)) return item;
    return { ...item, title, title_norm: normalizeTitle(title), topics, flags };
  });
}

function same<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
