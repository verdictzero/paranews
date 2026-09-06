import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { HEALTH_FILE } from "./config.ts";
import type { HealthFile, SourceHealth } from "./types.ts";

/** Consecutive failures before a source is quarantined. */
export const QUARANTINE_AFTER = 3;
/** Quarantined sources are re-probed this often so they can heal themselves. */
export const REPROBE_HOURS = 24;

export function loadHealth(path = HEALTH_FILE): HealthFile {
  if (!existsSync(path)) return { sources: {} };
  return JSON.parse(readFileSync(path, "utf8")) as HealthFile;
}

export function saveHealth(health: HealthFile, path = HEALTH_FILE): void {
  mkdirSync(dirname(path), { recursive: true });
  const sorted: HealthFile = { sources: {} };
  for (const id of Object.keys(health.sources).sort()) sorted.sources[id] = orderKeys(health.sources[id]);
  writeFileSync(path, JSON.stringify(sorted, null, 2) + "\n");
}

const KEY_ORDER: (keyof SourceHealth)[] = [
  "status", "consecutive_failures", "last_ok_at", "last_checked_at", "last_error",
  "last_http_status", "last_item_count", "quarantined_at", "etag", "last_modified",
];

function orderKeys(h: SourceHealth): SourceHealth {
  const out: Partial<SourceHealth> = {};
  for (const k of KEY_ORDER) if (h[k] !== undefined) (out as Record<string, unknown>)[k] = h[k];
  return out as SourceHealth;
}

export function entry(health: HealthFile, id: string): SourceHealth {
  return (health.sources[id] ??= { status: "ok", consecutive_failures: 0 });
}

/** Skip quarantined sources except for a daily probe. */
export function shouldSkip(health: HealthFile, id: string, now: Date): boolean {
  const h = health.sources[id];
  if (!h || h.status !== "quarantined" || !h.last_checked_at) return false;
  return now.getTime() - Date.parse(h.last_checked_at) < REPROBE_HOURS * 3_600_000;
}

export function recordSuccess(
  health: HealthFile,
  id: string,
  info: { status: number; itemCount: number; etag?: string; lastModified?: string; notModified?: boolean },
  now: Date,
): void {
  const h = entry(health, id);
  h.status = "ok";
  h.consecutive_failures = 0;
  h.last_ok_at = now.toISOString();
  h.last_checked_at = now.toISOString();
  h.last_http_status = info.status;
  if (!info.notModified) h.last_item_count = info.itemCount;
  delete h.last_error;
  delete h.quarantined_at;
  if (info.etag) h.etag = info.etag;
  else if (!info.notModified) delete h.etag;
  if (info.lastModified) h.last_modified = info.lastModified;
  else if (!info.notModified) delete h.last_modified;
}

/** Returns true when this failure is the one that quarantines the source. */
export function recordFailure(health: HealthFile, id: string, error: string, status: number, now: Date): boolean {
  const h = entry(health, id);
  h.consecutive_failures += 1;
  h.last_checked_at = now.toISOString();
  h.last_error = error;
  h.last_http_status = status;
  // Stale validators would keep returning 304 against a broken cache; drop them.
  delete h.etag;
  delete h.last_modified;
  if (h.status !== "quarantined" && h.consecutive_failures >= QUARANTINE_AFTER) {
    h.status = "quarantined";
    h.quarantined_at = now.toISOString();
    return true;
  }
  if (h.status !== "quarantined") h.status = "failing";
  return false;
}

export function markDisabled(health: HealthFile, id: string): void {
  const h = entry(health, id);
  h.status = "disabled";
  h.consecutive_failures = 0;
  delete h.last_error;
  delete h.quarantined_at;
}
