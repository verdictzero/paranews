import type { APIRoute } from "astro";
import { toCsv } from "../../../pipeline/csv";
import { MAP_MODES, timeline, type MapMode } from "../../lib/sightings";

export function getStaticPaths() {
  return MAP_MODES.map((mode) => ({ params: { mode: mode.slug }, props: { mode } }));
}

/** Every day in the run, including the empty ones: the gaps are part of the shape. */
export const GET: APIRoute = ({ props }) => {
  const mode = props.mode as MapMode;
  const csv = toCsv(timeline(mode.topic), [
    { key: "date", value: (d) => d.date },
    { key: "reports", value: (d) => d.count },
    { key: "placed_on_map", value: (d) => d.placed },
  ]);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="paranews-${mode.slug}-frequency.csv"`,
    },
  });
};
