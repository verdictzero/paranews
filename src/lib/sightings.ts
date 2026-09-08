import { locate } from "../../pipeline/geocode.ts";
import type { Topic } from "../../pipeline/types.ts";
import { getSiteData, primaryOf, storyPath, type SiteData } from "./site.ts";

/** One mappable story. Everything the map needs and nothing else. */
export interface Sighting {
  id: string;
  title: string;
  /** ISO date of the earliest report. */
  date: string;
  place: string;
  /** "New Mexico", "Scotland" — omitted when the place is itself a region. */
  admin?: string;
  lat: number;
  lon: number;
  /** landmark | city | region | country: how precise the pin is. */
  precision: string;
  /** headline | dateline | implied: how the location was established. */
  from: string;
  publisher: string;
  tier: string;
  outlets: number;
  /** Site-relative path to the story page. */
  href: string;
  topics: Topic[];
}

const cache = new Map<Topic, Sighting[]>();

/**
 * Stories on a beat that could be placed on a map, oldest first.
 *
 * Derived from clusters rather than items so one event is one pin, and from
 * the whole archive rather than the rolling window, because the map is the
 * archival view. Roughly one story in eight resolves; the rest name no place a
 * headline or dateline can be trusted on, and are simply absent.
 */
export function sightings(topic: Topic, data: SiteData = getSiteData()): Sighting[] {
  const hit = cache.get(topic);
  if (hit) return hit;
  const out: Sighting[] = [];
  for (const cluster of data.allClusters) {
    if (!cluster.topics.includes(topic)) continue;
    const primary = primaryOf(cluster, data);
    const article = primary ? data.articles.get(primary.id) : undefined;
    const located = locate(cluster.title, article ? `${article.excerpt ?? ""} ${article.content}` : undefined);
    if (!located) continue;
    out.push({
      id: cluster.id,
      title: cluster.title,
      date: cluster.first_published,
      place: located.place.name,
      admin: located.place.admin,
      lat: located.place.lat,
      lon: located.place.lon,
      precision: located.place.kind,
      from: located.from,
      publisher: primary?.publisher ?? cluster.publishers[0] ?? "",
      tier: cluster.tier,
      outlets: cluster.publishers.length,
      href: storyPath(cluster),
      topics: cluster.topics,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  cache.set(topic, out);
  return out;
}

export interface MapMode {
  topic: Topic;
  slug: string;
  title: string;
  blurb: string;
}

export const MAP_MODES: MapMode[] = [
  {
    topic: "ufo",
    slug: "ufo",
    title: "UFO / UAP sightings",
    blurb: "Every reported sighting the wire has carried since it started, placed where the report says it happened.",
  },
  {
    topic: "cryptids",
    slug: "cryptids",
    title: "Cryptid sightings",
    blurb: "Bigfoot, lake monsters and everything else that keeps not being found, placed by where it was reported.",
  },
];
