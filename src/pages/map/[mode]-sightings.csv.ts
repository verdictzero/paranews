import type { APIRoute } from "astro";
import { toCsv } from "../../../pipeline/csv";
import { MAP_MODES, sightings, type MapMode } from "../../lib/sightings";
import { absolute, href } from "../../lib/site";

export function getStaticPaths() {
  return MAP_MODES.map((mode) => ({ params: { mode: mode.slug }, props: { mode } }));
}

export const GET: APIRoute = ({ props, site }) => {
  const mode = props.mode as MapMode;
  const csv = toCsv(sightings(mode.topic), [
    { key: "date", value: (s) => s.date },
    { key: "place", value: (s) => s.place },
    { key: "region", value: (s) => s.admin },
    { key: "latitude", value: (s) => Number(s.lat.toFixed(5)) },
    { key: "longitude", value: (s) => Number(s.lon.toFixed(5)) },
    { key: "precision", value: (s) => s.precision },
    { key: "located_by", value: (s) => s.from },
    { key: "title", value: (s) => s.title },
    { key: "publisher", value: (s) => s.publisher },
    { key: "tier", value: (s) => s.tier },
    { key: "outlets", value: (s) => s.outlets },
    { key: "story_url", value: (s) => absolute(s.href, site) },
  ]);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="paranews-${mode.slug}-sightings.csv"`,
    },
  });
};
