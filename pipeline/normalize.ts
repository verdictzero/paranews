import type { RawEntry } from "./feeds.ts";
import { TOPICS, type Flag, type Item, type SourceConfig, type Topic } from "./types.ts";
import { isEntertainmentPublisher, publisherTier } from "./config.ts";
import { classifyFlags, classifyTopics, isOffTopic } from "./classify.ts";
import { cleanTitle, collapseWhitespace, itemId, normalizeTitle, stripHtml, stripPublisherSuffix, truncate } from "./text.ts";

const OPAQUE_LINK = /^https?:\/\/news\.google\.com\/rss\/articles\//i;
/** Video-mirror spam pages title themselves "<anything> (YouTubeId)". */
const JUNK_TITLE = /\([A-Za-z0-9_-]{10,12}\)\s*$/;
const SNIPPET_MAX = 300;

export function sortTopics(topics: Iterable<Topic>): Topic[] {
  const set = new Set(topics);
  return TOPICS.filter((t) => set.has(t));
}

/** Turn a feed entry into an Item, or undefined when it is off-topic or unusable. */
export function normalizeEntry(entry: RawEntry, source: SourceConfig, now: Date): Item | undefined {
  const isGoogle = source.kind === "google-news";
  const publisher = isGoogle ? entry.source?.name?.trim() || "Google News" : source.name;

  let title = cleanTitle(entry.title);
  if (isGoogle) title = stripPublisherSuffix(title, publisher);
  if (title.length < 8 || JUNK_TITLE.test(title) || isOffTopic(title)) return undefined;
  // One- and two-word "headlines" are photo captions and section labels, not stories.
  if (title.split(/\s+/).length < 3 && title.length < 20) return undefined;

  const url = entry.link.trim();
  if (!/^https?:\/\//i.test(url)) return undefined;

  const classified = classifyTopics(title);
  let topics: Topic[];
  if (source.topics === "auto") {
    topics = classified.length ? classified : source.default_topic ? [source.default_topic] : [];
    if (!topics.length) return undefined;
  } else {
    topics = sortTopics([...source.topics, ...classified]);
  }
  const flags = computeFlags(title, publisher, isGoogle);

  const title_norm = normalizeTitle(title);
  return {
    id: itemId(title_norm, publisher),
    title,
    title_norm,
    url,
    url_opaque: OPAQUE_LINK.test(url),
    publisher,
    publisher_url: isGoogle ? entry.source?.url : undefined,
    tier: isGoogle ? publisherTier(publisher) : source.tier!,
    topics,
    flags,
    published_at: parseDate(entry.published, now),
    first_seen_at: now.toISOString(),
    feed_id: source.id,
    snippet: makeSnippet(entry, title, publisher, isGoogle),
    image: entry.image && /^https:\/\//i.test(entry.image) ? entry.image : undefined,
  };
}

/**
 * Every editorial flag for a headline. Shared by ingest (recorded on the item)
 * and by the build (recomputed, so classifier fixes apply to the whole archive).
 */
export function computeFlags(title: string, publisher: string, isGoogle: boolean): Flag[] {
  const flags = new Set<Flag>(classifyFlags(title));
  if (isEntertainmentPublisher(publisher)) flags.add("entertainment");
  // A beat search matched the article body, but the headline names nothing from any
  // beat. Direct feeds are on-beat by construction, so only searches get the flag.
  if (isGoogle && !classifyTopics(title).length) flags.add("weak-match");
  return [...flags].sort();
}

/** Feed dates are unreliable: missing, unparseable or in the future all collapse to "now". */
export function parseDate(raw: string | undefined, now: Date): string {
  if (!raw) return now.toISOString();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return now.toISOString();
  if (d.getTime() > now.getTime() + 60 * 60 * 1000) return now.toISOString();
  return d.toISOString();
}

const REDDIT_BOILERPLATE = /submitted by\s+\/u\/\S+.*$|\[link\]|\[comments\]/gi;

function makeSnippet(entry: RawEntry, title: string, publisher: string, isGoogle: boolean): string | undefined {
  // Google News descriptions are only ever the headline and publisher again.
  if (isGoogle) return undefined;
  const raw = entry.content || entry.summary;
  if (!raw) return undefined;
  let text = collapseWhitespace(stripHtml(raw).replace(REDDIT_BOILERPLATE, " "));
  // Many feeds echo the headline (with different quote marks) before the body.
  const key = (s: string) => normalizeTitle(cleanTitle(s));
  const textKey = key(text);
  const titleKey = key(title);
  if (textKey === titleKey || textKey === key(`${title} ${publisher}`)) return undefined;
  if (titleKey && textKey.startsWith(titleKey)) {
    const words = title.trim().split(/\s+/).length;
    text = collapseWhitespace(text.split(/\s+/).slice(words).join(" "));
  }
  if (text.length < 40) return undefined;
  return truncate(text, SNIPPET_MAX);
}
