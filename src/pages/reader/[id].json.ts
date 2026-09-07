import type { APIRoute } from "astro";
import type { ArticleRecord } from "../../../pipeline/articles";
import { getSiteData, href, readerImagePath } from "../../lib/site";

export function getStaticPaths() {
  return [...getSiteData().articles.values()].map((article) => ({ params: { id: article.id }, props: { article } }));
}

/** What the reader dialog loads: the sanitized copy plus what the site knows about the item. */
export const GET: APIRoute = ({ props }) => {
  const article = props.article as ArticleRecord;
  const item = getSiteData().items.get(article.id);
  const payload = {
    id: article.id,
    title: article.title,
    byline: article.byline,
    site_name: article.site_name,
    publisher: item?.publisher,
    published_at: item?.published_at,
    url: article.url,
    words: article.words,
    image: article.image ? { src: href(readerImagePath(article.id)), width: article.image.width, height: article.image.height } : null,
    content: article.content,
  };
  return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json; charset=utf-8" } });
};
