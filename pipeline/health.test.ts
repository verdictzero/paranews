import { test } from "node:test";
import assert from "node:assert/strict";
import { QUARANTINE_AFTER, recordFailure, recordSuccess, shouldSkip } from "./health.ts";
import type { HealthFile } from "./types.ts";

test("three failures quarantine, a success heals, quarantined sources are probed daily", () => {
  const h: HealthFile = { sources: {} };
  const t = (hours: number) => new Date(Date.UTC(2026, 8, 6, hours));
  for (let i = 1; i < QUARANTINE_AFTER; i++) {
    assert.equal(recordFailure(h, "x", "HTTP 429", 429, t(i)), false);
    assert.equal(h.sources.x.status, "failing");
  }
  assert.equal(recordFailure(h, "x", "HTTP 429", 429, t(3)), true, "third failure quarantines");
  assert.equal(h.sources.x.status, "quarantined");
  assert.equal(h.sources.x.consecutive_failures, 3);
  assert.equal(shouldSkip(h, "x", t(4)), true);
  assert.equal(shouldSkip(h, "x", t(3 + 25)), false);
  assert.equal(recordFailure(h, "x", "HTTP 429", 429, t(30)), false, "already quarantined: no second transition");

  recordSuccess(h, "x", { status: 200, itemCount: 12, etag: '"e"' }, t(31));
  assert.equal(h.sources.x.status, "ok");
  assert.equal(h.sources.x.consecutive_failures, 0);
  assert.equal(h.sources.x.quarantined_at, undefined);
  assert.equal(h.sources.x.etag, '"e"');
  assert.equal(h.sources.x.last_item_count, 12);

  recordSuccess(h, "x", { status: 304, itemCount: 0, notModified: true }, t(32));
  assert.equal(h.sources.x.etag, '"e"', "304 keeps validators");
  assert.equal(h.sources.x.last_item_count, 12, "304 keeps the last real count");

  recordFailure(h, "x", "boom", 0, t(33));
  assert.equal(h.sources.x.etag, undefined, "failure drops validators");
});
