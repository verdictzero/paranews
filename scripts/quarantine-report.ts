/**
 * Print GitHub issue payloads for sources the last ingest quarantined, as a
 * JSON array of { id, title, body }. The update workflow feeds this to `gh`.
 */
import { existsSync, readFileSync } from "node:fs";
import { CACHE_DIR, loadSources, sourceUrl } from "../pipeline/config.ts";
import { loadHealth } from "../pipeline/health.ts";

const path = `${CACHE_DIR}/quarantined.json`;
const ids: string[] = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as string[]) : [];
const health = loadHealth();
const sources = loadSources().sources;

const issues = ids.flatMap((id) => {
  const s = sources.find((x) => x.id === id);
  if (!s) return [];
  const h = health.sources[id];
  const body = [
    `The ingest pipeline quarantined **${s.name}** (\`${id}\`) after ${h?.consecutive_failures ?? "several"} consecutive failures.`,
    "",
    `- URL: ${sourceUrl(s)}`,
    `- Last error: \`${h?.last_error ?? "unknown"}\` (HTTP ${h?.last_http_status ?? "n/a"})`,
    `- Last success: ${h?.last_ok_at ?? "never"}`,
    "",
    "It will be re-probed once a day and un-quarantined automatically on the first success.",
    "If the feed has moved or died, fix the URL in `config/sources.yml`, or set `enabled: false` with a `note` explaining why.",
  ].join("\n");
  return [{ id, title: `Source quarantined: ${id}`, body }];
});

process.stdout.write(JSON.stringify(issues) + "\n");
