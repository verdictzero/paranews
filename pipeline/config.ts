import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { TIERS, TOPICS, type SourceConfig, type SourcesFile, type Tier, type Topic } from "./types.ts";
import { publisherKey } from "./text.ts";

// Resolved from the working directory, not import.meta.url: Astro bundles this
// module under dist/.prerender/ at build time, which would point ROOT at dist.
export const ROOT = (process.env.PARANEWS_ROOT ?? process.cwd()).replace(/\/?$/, "/");
export const DATA_DIR = `${ROOT}data`;
export const ITEMS_DIR = `${DATA_DIR}/items`;
export const HEALTH_FILE = `${DATA_DIR}/health.json`;
export const META_FILE = `${DATA_DIR}/meta.json`;
export const CACHE_DIR = `${ROOT}.cache`;

/**
 * Google News silently ignores the when:7d operator on long queries (a 309-char
 * query returned only years-old items; 186 chars was fine). Keep queries short.
 */
export const MAX_GN_QUERY_LENGTH = 190;

/** Rolling window of items that feed clustering and the site. Older shards stay on disk as the archive. */
export const WINDOW_DAYS = 30;

const TIER_SET = new Set<string>(TIERS);
const TOPIC_SET = new Set<string>(TOPICS);

let cached: SourcesFile | undefined;

export function loadSources(path = `${ROOT}config/sources.yml`): SourcesFile {
  if (cached) return cached;
  const raw = parse(readFileSync(path, "utf8")) as SourcesFile;
  validate(raw);
  cached = raw;
  return raw;
}

function validate(file: SourcesFile): void {
  const seen = new Set<string>();
  for (const s of file.sources) {
    if (!s.id || seen.has(s.id)) throw new Error(`sources.yml: duplicate or missing source id "${s.id}"`);
    seen.add(s.id);
    if (!/^[a-z0-9-]+$/.test(s.id)) throw new Error(`sources.yml: source id "${s.id}" must be kebab-case`);
    if (s.kind !== "rss" && s.kind !== "google-news") throw new Error(`sources.yml: ${s.id}: bad kind "${s.kind}"`);
    if (s.kind === "rss" && !/^https?:\/\//.test(s.url ?? "")) throw new Error(`sources.yml: ${s.id}: rss sources need a url`);
    if (s.kind === "google-news" && !s.query) throw new Error(`sources.yml: ${s.id}: google-news sources need a query`);
    if (s.kind === "google-news" && s.query!.length > MAX_GN_QUERY_LENGTH)
      throw new Error(`sources.yml: ${s.id}: query is ${s.query!.length} chars; Google News drops the when: filter past ~${MAX_GN_QUERY_LENGTH}. Split it.`);
    if (s.kind === "google-news" && s.edition && s.edition !== "US" && s.edition !== "GB")
      throw new Error(`sources.yml: ${s.id}: edition must be US or GB`);
    if (s.tier && !TIER_SET.has(s.tier)) throw new Error(`sources.yml: ${s.id}: bad tier "${s.tier}"`);
    if (s.kind === "rss" && !s.tier) throw new Error(`sources.yml: ${s.id}: rss sources need a tier`);
    if (s.topics !== "auto") {
      for (const t of s.topics) if (!TOPIC_SET.has(t)) throw new Error(`sources.yml: ${s.id}: bad topic "${t}"`);
    }
    if (s.default_topic && !TOPIC_SET.has(s.default_topic)) throw new Error(`sources.yml: ${s.id}: bad default_topic`);
  }
  for (const p of file.publishers.patterns) {
    if (!TIER_SET.has(p.tier)) throw new Error(`sources.yml: publisher pattern tier "${p.tier}" invalid`);
    new RegExp(p.pattern, "i"); // throws on a bad pattern
  }
  if (!TIER_SET.has(file.publishers.default)) throw new Error("sources.yml: publishers.default invalid");
  file.publishers.entertainment ??= [];
  file.publishers.entertainment_patterns ??= [];
  for (const p of file.publishers.entertainment_patterns) new RegExp(p, "i");
}

const GN_EDITIONS = { US: { hl: "en-US", gl: "US", ceid: "US:en" }, GB: { hl: "en-GB", gl: "GB", ceid: "GB:en" } };

/** Google News RSS search URL for a query. `when:7d` keeps each poll to recent coverage. */
export function googleNewsUrl(query: string, edition: "US" | "GB" = "US"): string {
  const e = GN_EDITIONS[edition];
  const q = encodeURIComponent(`${query} when:7d`);
  return `https://news.google.com/rss/search?q=${q}&hl=${e.hl}&gl=${e.gl}&ceid=${e.ceid}`;
}

export function sourceUrl(s: SourceConfig): string {
  return s.kind === "google-news" ? googleNewsUrl(s.query!, s.edition) : s.url!;
}

export function enabledSources(): SourceConfig[] {
  return loadSources().sources.filter((s) => s.enabled);
}

let lookup: { exact: Map<string, Tier>; patterns: { tier: Tier; re: RegExp }[]; fallback: Tier } | undefined;

/** Tier for a publisher name: explicit list, then name patterns, then the configured default. */
export function publisherTier(name: string): Tier {
  if (!lookup) {
    const { publishers } = loadSources();
    const exact = new Map<string, Tier>();
    for (const tier of TIERS) for (const n of publishers[tier]) exact.set(publisherKey(n), tier);
    lookup = {
      exact,
      patterns: publishers.patterns.map((p) => ({ tier: p.tier, re: new RegExp(p.pattern, "i") })),
      fallback: publishers.default,
    };
  }
  const hit = lookup.exact.get(publisherKey(name));
  if (hit) return hit;
  for (const p of lookup.patterns) if (p.re.test(name)) return p.tier;
  return lookup.fallback;
}

let entertainment: { exact: Set<string>; patterns: RegExp[] } | undefined;

/** True for outlets whose coverage of the paranormal is always about media, never about events. */
export function isEntertainmentPublisher(name: string): boolean {
  if (!entertainment) {
    const { publishers } = loadSources();
    entertainment = {
      exact: new Set(publishers.entertainment.map(publisherKey)),
      patterns: publishers.entertainment_patterns.map((p) => new RegExp(p, "i")),
    };
  }
  if (entertainment.exact.has(publisherKey(name))) return true;
  return entertainment.patterns.some((re) => re.test(name));
}

export function tierRank(t: Tier): number {
  return TIERS.indexOf(t);
}

export function bestTier(tiers: Tier[]): Tier {
  return tiers.reduce((best, t) => (tierRank(t) < tierRank(best) ? t : best), "unverified" as Tier);
}

export function isTopic(s: string): s is Topic {
  return TOPIC_SET.has(s);
}

/** Test seam: drop cached config so a test can point at a fixture file. */
export function resetConfigCache(): void {
  cached = undefined;
  lookup = undefined;
  entertainment = undefined;
}
