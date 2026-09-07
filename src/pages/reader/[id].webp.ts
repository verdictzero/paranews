import { readFileSync } from "node:fs";
import type { APIRoute } from "astro";
import { imagePath } from "../../../pipeline/articles";
import { getSiteData } from "../../lib/site";

export function getStaticPaths() {
  return [...getSiteData().articles.values()].filter((a) => a.image).map((a) => ({ params: { id: a.id } }));
}

export const GET: APIRoute = ({ params }) => {
  return new Response(Uint8Array.from(readFileSync(imagePath(params.id!))), { headers: { "content-type": "image/webp" } });
};
