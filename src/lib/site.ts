import { existsSync, readFileSync } from "node:fs";
import { META_FILE, WINDOW_DAYS, googleNewsUrl, loadSources } from "../../pipeline/config.ts";
import { ShardStore } from "../../pipeline/store.ts";
import { buildClusters } from "../../pipeline/cluster.ts";
import { byScore, interleave } from "../../pipeline/rank.ts";
import { loadHealth } from "../../pipeline/health.ts";
import { isVisible, refreshItems } from "../../pipeline/visibility.ts";
import { loadAllArticles, type ArticleRecord } from "../../pipeline/articles.ts";
import { truncate } from "../../pipeline/text.ts";
import { TOPICS, type Cluster, type HealthFile, type Item, type MetaFile, type SourceConfig, type SourcesFile, type Tier, type Topic } from "../../pipeline/types.ts";

export const SITE_NAME = "Paranews";
export const SITE_TAGLINE = "UFOs, hauntings, cryptids and high strangeness.";

export const TOPIC_LABEL: Record<Topic, string> = {
  ufo: "UFO / UAP",
  ghosts: "Hauntings",
  cryptids: "Cryptids",
  fortean: "High Strangeness",
  archaeology: "Anomalous Archaeology",
  ooparts: "OOPArts",
};

export const TOPIC_BLURB: Record<Topic, string> = {
  ufo: "Sightings, disclosure politics, AARO and the Pentagon, the people who claim to know.",
  ghosts: "Investigations, poltergeists, exorcisms and the places that will not stay quiet.",
  cryptids: "Bigfoot, lake monsters, Mothman and every creature that keeps not being found.",
  fortean: "Mysterious lights and sounds, crop circles, psi research, time slips and Fortean classics.",
  archaeology: "Sites that do not fit the timeline: sunken cities, chambers found by radar, impossible engineering.",
  ooparts: "Out-of-place artifacts. The Antikythera mechanism, the Piri Reis map, and every object found where it should not be.",
};

/** Nav labels only. "Anomalous Archaeology" set in uppercase wraps the bar. */
export const TOPIC_NAV_LABEL: Record<Topic, string> = { ...TOPIC_LABEL, archaeology: "Archaeology" };

export const TIER_LABEL: Record<Tier, string> = {
  official: "Official / wire",
  press: "Press",
  genre: "Genre press",
  unverified: "Unverified",
};

export const TIER_BLURB: Record<Tier, string> = {
  official: "Wire services, government releases and scholarly publishers.",
  press: "Mainstream newsrooms and local broadcasters with editorial standards.",
  genre: "Genre outlets, tabloids and enthusiast sites. Real reporting, looser bar.",
  unverified: "Social media and single-witness blogs. A claim, not a report.",
};

/** Stories older than this never make the front page, however well they score. */
const FRONT_PAGE_DAYS = 7;
const FRONT_PAGE_COUNT = 12;
const SCHOLARLY_COUNT = 6;

export interface ArchiveMonth {
  /** YYYY-MM */
  key: string;
  label: string;
  /** Stories first published that month that have a reader copy, newest first. */
  clusters: Cluster[];
}

export interface SiteData {
  now: Date;
  /** Every item ever stored, so archived stories resolve like current ones. */
  items: Map<string, Item>;
  /** Reader copies by item id. */
  articles: Map<string, ArticleRecord>;
  /** Visible clusters in the window, best first. Entertainment clusters are already removed. */
  clusters: Cluster[];
  /** Clusters in the window that the entertainment filter removed. */
  hiddenCount: number;
  top: Cluster[];
  /**
   * Official-tier stories, newest first. They are rare and score far below the
   * front page — 0.009 to 0.027 against a 0.476 lead story — because scoring
   * rewards how widely a story is covered, and a preprint or a university
   * research note is covered once. Ranking them up would be dishonest; giving
   * them their own column is what a newspaper does.
   */
  scholarly: Cluster[];
  byTopic: Record<Topic, Cluster[]>;
  /** Stories with a reader copy, by month, newest month first. Kept for good. */
  archive: ArchiveMonth[];
  /** Every cluster that gets a story page: the window plus everything archived. */
  storyPages: Cluster[];
  meta?: MetaFile;
  health: HealthFile;
  sources: SourcesFile;
}

let cache: SiteData | undefined;

/** Everything a page needs, computed once per build. */
export function getSiteData(): SiteData {
  if (cache) return cache;
  const now = new Date();
  const store = new ShardStore();
  for (const date of store.availableDates()) store.load(date);
  const all = refreshItems(store.all());
  const items = new Map(all.map((i) => [i.id, i]));
  const articles = new Map(loadAllArticles().map((a) => [a.id, a]));

  const cutoff = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
  const everything = buildClusters(all, { now }).sort(byScore);
  const inWindow = everything.filter((c) => c.latest_published >= cutoff);
  const clusters = inWindow.filter(isVisible);
  const hiddenCount = inWindow.length - clusters.length;

  const fresh = new Date(now.getTime() - FRONT_PAGE_DAYS * 86_400_000).toISOString();
  const top = interleave(clusters.filter((c) => c.latest_published >= fresh).slice(0, FRONT_PAGE_COUNT * 3)).slice(0, FRONT_PAGE_COUNT);
  const byTopic = Object.fromEntries(TOPICS.map((t) => [t, clusters.filter((c) => c.topics.includes(t))])) as Record<Topic, Cluster[]>;
  const scholarly = clusters
    .filter((c) => c.tier === "official" && !c.flags.includes("notice"))
    .sort((a, b) => b.latest_published.localeCompare(a.latest_published))
    .slice(0, SCHOLARLY_COUNT);

  const archived = everything.filter((c) => isVisible(c) && c.items.some((id) => articles.has(id)));
  const archive = groupByMonth(archived);
  const pageIds = new Set(clusters.map((c) => c.id));
  const storyPages = [...clusters, ...archived.filter((c) => !pageIds.has(c.id))];

  const meta = existsSync(META_FILE) ? (JSON.parse(readFileSync(META_FILE, "utf8")) as MetaFile) : undefined;
  cache = { now, items, articles, clusters, hiddenCount, top, scholarly, byTopic, archive, storyPages, meta, health: loadHealth(), sources: loadSources() };
  return cache;
}

function groupByMonth(clusters: Cluster[]): ArchiveMonth[] {
  const months = new Map<string, Cluster[]>();
  for (const c of clusters) {
    const key = c.first_published.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), c]);
  }
  return [...months]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, list]) => ({
      key,
      label: new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      clusters: list.sort((a, b) => b.first_published.localeCompare(a.first_published) || a.id.localeCompare(b.id)),
    }));
}

export function itemsOf(cluster: Cluster, data: SiteData): Item[] {
  return cluster.items.map((id) => data.items.get(id)).filter((i): i is Item => Boolean(i));
}

export function primaryOf(cluster: Cluster, data: SiteData): Item {
  return data.items.get(cluster.primary) ?? itemsOf(cluster, data)[0];
}

export interface ReaderCopy {
  item: Item;
  article: ArticleRecord;
}

/** The story's reader copy: the best member that has one. */
export function readerFor(cluster: Cluster, data: SiteData): ReaderCopy | undefined {
  for (const id of cluster.items) {
    const article = data.articles.get(id);
    const item = data.items.get(id);
    if (article && item) return { item, article };
  }
  return undefined;
}

/** Feed description first, otherwise the opening of the reader copy. */
export function snippetOf(cluster: Cluster, data: SiteData): string | undefined {
  if (cluster.snippet) return cluster.snippet;
  const excerpt = readerFor(cluster, data)?.article.excerpt;
  return excerpt ? truncate(excerpt, 300) : undefined;
}

/** Site-relative href that respects the configured base path. */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
}

export function absolute(path: string, site: URL | undefined): string {
  return new URL(href(path), site ?? "http://localhost/").toString();
}

export function storyPath(cluster: Cluster): string {
  return `story/${cluster.id}/`;
}

export function topicPath(topic: Topic): string {
  return `topic/${topic}/`;
}

export function readerJsonPath(itemId: string): string {
  return `reader/${itemId}.json`;
}

export function readerImagePath(itemId: string): string {
  return `reader/${itemId}.webp`;
}

/** Display host for an external link; opaque Google News links show the publisher instead. */
export function hostOf(item: Item): string {
  if (item.url_opaque) return "via Google News";
  try {
    return new URL(item.url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Build-time relative time; the client script refreshes it after load. */
export function timeAgo(iso: string, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}

/** The human-facing Google News search for a query source (the RSS URL redirects poorly in browsers). */
export function googleNewsHref(s: SourceConfig): string {
  return googleNewsUrl(s.query ?? "", s.edition).replace("/rss/search?", "/search?");
}
