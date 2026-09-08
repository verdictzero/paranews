import type { APIRoute } from "astro";
import { MAP_MODES, sightings } from "../../lib/sightings";

export function getStaticPaths() {
  return MAP_MODES.map((mode) => ({ params: { mode: mode.slug }, props: { mode } }));
}

/** The map's data. Fetched by the page rather than inlined, so it caches on its own. */
export const GET: APIRoute = ({ props }) => {
  const mode = props.mode as (typeof MAP_MODES)[number];
  return new Response(JSON.stringify(sightings(mode.topic)), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
