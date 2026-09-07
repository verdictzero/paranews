import { existsSync, readFileSync } from "node:fs";
import { META_FILE, WINDOW_DAYS, googleNewsUrl, loadSources } from "../../pipeline/config.ts";
import { ShardStore } from "../../pipeline/store.ts";
import { buildClusters } from "../../pipeline/cluster.ts";
import { byScore, interleave } from "../../pipeline/rank.ts";
import { loadHealth } from "../../pipeline/health.ts";
import { isVisible, refreshFlags } from "../../pipeline/visibility.ts";
import { TOPICS, type Cluster, type HealthFile, type Item, type MetaFile, type SourceConfig, type SourcesFile, type Tier, type Topic } from "../../pipeline/types.ts";

export const SITE_NAME = "Paranews";
export const SITE_TAGLINE = "UFOs, hauntings, cryptids and high strangeness.";

export const TOPIC_LABEL: Record<Topic, string> = {
  ufo: "UFO / UAP",
  ghosts: "Hauntings",
  cryptids: "Cryptids",
  fortean: "High Strangeness",
};

export const TOPIC_BLURB: Record<Topic, string> = {
  ufo: "Sightings, disclosure politics, AARO and the Pentagon, the people who claim to know.",
  ghosts: "Investigations, poltergeists, exorcisms and the places that will not stay quiet.",
  cryptids: "Bigfoot, lake monsters, Mothman and every creature that keeps not being found.",
  fortean: "Mysterious lights, crop circles, disappearances and the weird edges of science.",
};

export const TIER_LABEL: Record<Tier, string> = {
  official: "Official / wire",
  press: "Press",
  genre: "Genre press",
  unverified: "Unverified",
};

export const TIER_BLURB: Record<Tier, string> = {
  official: "Wire services, government releases and peer-reviewed journals.",
  press: "Mainstream newsrooms and local broadcasters with editorial standards.",
  genre: "Genre outlets, tabloids and enthusiast sites. Real reporting, looser bar.",
  unverified: "Social media and single-witness blogs. A claim, not a report.",
};

/** Stories older than this never make the front page, however well they score. */
const FRONT_PAGE_DAYS = 7;
const FRONT_PAGE_COUNT = 12;

export interface SiteData {
  now: Date;
  items: Map<string, Item>;
  /** Visible clusters, best first. Entertainment clusters are already removed. */
  clusters: Cluster[];
  /** Clusters in the window that the entertainment filter removed. */
  hiddenCount: number;
  top: Cluster[];
  byTopic: Record<Topic, Cluster[]>;
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
  store.loadWindow(now);
  const cutoff = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
  const windowItems = refreshFlags(store.all().filter((i) => i.published_at >= cutoff));
  const items = new Map(windowItems.map((i) => [i.id, i]));
  const everything = buildClusters(windowItems, { now }).sort(byScore);
  const clusters = everything.filter(isVisible);
  const hiddenCount = everything.length - clusters.length;
  const fresh = new Date(now.getTime() - FRONT_PAGE_DAYS * 86_400_000).toISOString();
  const top = interleave(clusters.filter((c) => c.latest_published >= fresh).slice(0, FRONT_PAGE_COUNT * 3)).slice(0, FRONT_PAGE_COUNT);
  const byTopic = Object.fromEntries(TOPICS.map((t) => [t, clusters.filter((c) => c.topics.includes(t))])) as Record<Topic, Cluster[]>;
  const meta = existsSync(META_FILE) ? (JSON.parse(readFileSync(META_FILE, "utf8")) as MetaFile) : undefined;
  cache = { now, items, clusters, hiddenCount, top, byTopic, meta, health: loadHealth(), sources: loadSources() };
  return cache;
}

export function itemsOf(cluster: Cluster, data: SiteData): Item[] {
  return cluster.items.map((id) => data.items.get(id)).filter((i): i is Item => Boolean(i));
}

export function primaryOf(cluster: Cluster, data: SiteData): Item {
  return data.items.get(cluster.primary) ?? itemsOf(cluster, data)[0];
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
