/** Editorial topic verticals. Order here is the display order. */
export const TOPICS = ["ufo", "ghosts", "cryptids", "fortean"] as const;
export type Topic = (typeof TOPICS)[number];

/**
 * Publisher credibility tiers. Deterministic: assigned by publisher lookup
 * (config/sources.yml), never inferred from the story text.
 *   official    - wire services, government, peer-reviewed journals
 *   press       - mainstream newsrooms, local broadcast
 *   genre       - genre press, tabloids, enthusiast sites
 *   unverified  - social media, single-witness blogs
 */
export const TIERS = ["official", "press", "genre", "unverified"] as const;
export type Tier = (typeof TIERS)[number];

/**
 * Editorial flags that demote (never hide) a story in ranking.
 *   entertainment - fiction and its promotion: films, shows, games, books, stage, music, merch (hidden from the site)
 *   attraction    - Halloween attractions, ghost tours
 *   weak-match    - found by a beat search but the headline names no beat keyword
 */
export type Flag = "entertainment" | "attraction" | "weak-match";

export interface SourceConfig {
  id: string;
  name: string;
  kind: "rss" | "google-news";
  /** Feed URL for rss sources. */
  url?: string;
  /** Search query for google-news sources; the URL is built from it. */
  query?: string;
  /** Google News edition for google-news sources. */
  edition?: "US" | "GB";
  /** Tier applied to items from this feed. Google News items use the publisher lookup instead. */
  tier?: Tier;
  /** Fixed topic(s) for every item, or "auto" to classify by keywords. */
  topics: Topic[] | "auto";
  /** Topic used when "auto" classification finds nothing. Omit to drop unmatched items. */
  default_topic?: Topic;
  enabled: boolean;
  /** Why a source is disabled - kept so a future feed-discovery pass doesn't rediscover the problem. */
  note?: string;
}

export interface SourcesFile {
  sources: SourceConfig[];
  publishers: {
    official: string[];
    press: string[];
    genre: string[];
    unverified: string[];
    /** Regexes (string form) matched against the publisher name, in tier order. */
    patterns: { tier: Tier; pattern: string }[];
    default: Tier;
    /** Outlets whose paranormal coverage is film/TV/games/stage/music by nature. Every item gets the entertainment flag. */
    entertainment: string[];
    /** Regexes (string form) matched against the publisher name for the same purpose. */
    entertainment_patterns: string[];
  };
}

/** One normalized feed entry. Items are the source of truth; clusters are derived. */
export interface Item {
  /** hash(title_norm | publisher_norm) - stable across runs, independent of the opaque GN link. */
  id: string;
  title: string;
  title_norm: string;
  url: string;
  /** True when `url` is an opaque news.google.com redirect that won't resolve server-side. */
  url_opaque: boolean;
  publisher: string;
  /** Publisher homepage when the feed exposes it (GN <source url>). */
  publisher_url?: string;
  tier: Tier;
  topics: Topic[];
  flags: Flag[];
  published_at: string;
  first_seen_at: string;
  feed_id: string;
  snippet?: string;
  image?: string;
}

export interface Cluster {
  id: string;
  title: string;
  /** Item id whose link is the cluster's primary link. */
  primary: string;
  /** Member item ids, best first. */
  items: string[];
  /** Distinct outlets (aliases folded), best first. */
  publishers: string[];
  tier: Tier;
  /** Independent official/press write-ups: distinct headlines, not syndicated copies. */
  corroboration: number;
  topics: Topic[];
  flags: Flag[];
  first_published: string;
  latest_published: string;
  snippet?: string;
  image?: string;
  score: number;
}

export type SourceStatus = "ok" | "failing" | "quarantined" | "disabled";

export interface SourceHealth {
  status: SourceStatus;
  consecutive_failures: number;
  last_ok_at?: string;
  last_checked_at?: string;
  last_error?: string;
  last_http_status?: number;
  last_item_count?: number;
  quarantined_at?: string;
  etag?: string;
  last_modified?: string;
}

export interface HealthFile {
  sources: Record<string, SourceHealth>;
}

export interface MetaFile {
  last_run_at: string;
  last_run_new_items: number;
  total_items: number;
}
