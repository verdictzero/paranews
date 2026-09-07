import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { TOPICS, type Topic } from "../../../pipeline/types";
import { SITE_NAME, TIER_LABEL, TOPIC_BLURB, TOPIC_LABEL, absolute, getSiteData, primaryOf, storyPath } from "../../lib/site";

const FEED_SIZE = 50;

export function getStaticPaths() {
  return TOPICS.map((topic) => ({ params: { topic } }));
}

export function GET(context: APIContext): Promise<Response> {
  const topic = context.params.topic as Topic;
  const data = getSiteData();
  const items = data.byTopic[topic].slice(0, FEED_SIZE).map((c) => {
    const primary = primaryOf(c, data);
    const lead = c.snippet ? `${c.snippet} — ` : "";
    return {
      title: c.title,
      link: absolute(storyPath(c), context.site),
      pubDate: new Date(c.latest_published),
      description: `${lead}${TIER_LABEL[c.tier]} · ${c.publishers.join(", ")}. Read at ${primary.publisher}: ${primary.url}`,
      categories: [...c.topics],
    };
  });
  return rss({
    title: `${SITE_NAME} · ${TOPIC_LABEL[topic]}`,
    description: TOPIC_BLURB[topic],
    site: context.site ?? "http://localhost/",
    items,
    customData: "<language>en</language>",
  });
}
