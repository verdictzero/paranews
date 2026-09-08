import type { APIRoute } from "astro";
import { MAP_MODES, timeline, type MapMode } from "../../lib/sightings";

export function getStaticPaths() {
  return MAP_MODES.map((mode) => ({ params: { mode: mode.slug }, props: { mode } }));
}

export const GET: APIRoute = ({ props }) => {
  const mode = props.mode as MapMode;
  return new Response(JSON.stringify(timeline(mode.topic)), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
