import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { SITE_NAME, SITE_TAGLINE, TIER_LABEL, absolute, getSiteData, primaryOf, storyPath } from "../lib/site";

const FEED_SIZE = 50;

export function GET(context: APIContext): Promise<Response> {
  const data = getSiteData();
  const items = data.clusters.slice(0, FEED_SIZE).map((c) => {
    const primary = primaryOf(c, data);
    const outlets = c.publishers.join(", ");
    const lead = c.snippet ? `${c.snippet} — ` : "";
    return {
      title: c.title,
      link: absolute(storyPath(c), context.site),
      pubDate: new Date(c.latest_published),
      description: `${lead}${TIER_LABEL[c.tier]} · ${outlets}. Read at ${primary.publisher}: ${primary.url}`,
      categories: [...c.topics],
    };
  });
  return rss({
    title: SITE_NAME,
    description: SITE_TAGLINE,
    site: context.site ?? "http://localhost/",
    items,
    customData: "<language>en</language>",
  });
}
