import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_POLLS_ALLOWED, QUARANTINE_AFTER, emptyIsFailure, recordFailure, recordSuccess, shouldSkip } from "./health.ts";
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

test("an empty poll is tolerated until the feed has been empty for a day", () => {
  const health: HealthFile = { sources: {} };
  const now = new Date("2026-09-08T00:00:00Z");
  recordSuccess(health, "tag-feed", { status: 200, itemCount: 3 }, now);
  assert.equal(health.sources["tag-feed"].consecutive_empty, undefined);
  assert.equal(emptyIsFailure(health, "tag-feed"), false);

  for (let i = 1; i < EMPTY_POLLS_ALLOWED; i++) {
    recordSuccess(health, "tag-feed", { status: 200, itemCount: 0 }, now);
    assert.equal(emptyIsFailure(health, "tag-feed"), false, `still fine after ${i} empty polls`);
  }
  recordSuccess(health, "tag-feed", { status: 200, itemCount: 0 }, now);
  assert.equal(health.sources["tag-feed"].consecutive_empty, EMPTY_POLLS_ALLOWED);
  assert.equal(emptyIsFailure(health, "tag-feed"), true, "a day of empty polls is a dead feed");
  assert.equal(health.sources["tag-feed"].status, "ok", "still ok until the caller records a failure");

  // One real item resets the count.
  recordSuccess(health, "tag-feed", { status: 200, itemCount: 1 }, now);
  assert.equal(emptyIsFailure(health, "tag-feed"), false);

  // A 304 says nothing about emptiness either way.
  recordSuccess(health, "tag-feed", { status: 200, itemCount: 0 }, now);
  recordSuccess(health, "tag-feed", { status: 304, itemCount: 0, notModified: true }, now);
  assert.equal(health.sources["tag-feed"].consecutive_empty, 1);

  // A hard failure clears it: the next empty poll starts a fresh count.
  recordFailure(health, "tag-feed", "HTTP 500", 500, now);
  assert.equal(health.sources["tag-feed"].consecutive_empty, undefined);
});
