import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_ATTEMPTS, archivedIds, isDue, loadAllArticles, loadArticle, loadStatus, pruneStatus, recordAttempt,
  saveArticle, saveImage, saveStatus, serializeArticle, type ArticleRecord, type StatusFile,
} from "./articles.ts";

const T0 = new Date("2026-09-07T00:00:00Z");
const hours = (h: number): Date => new Date(T0.getTime() + h * 3_600_000);

test("attempts back off and become final after the limit", () => {
  const status: StatusFile = {};
  assert.equal(isDue(status, "a", T0), true);
  const first = recordAttempt(status, "a", "HTTP 503", false, T0);
  assert.equal(first.attempts, 1);
  assert.equal(first.next_attempt_at, hours(2).toISOString());
  assert.equal(isDue(status, "a", hours(1)), false);
  assert.equal(isDue(status, "a", hours(2)), true);
  recordAttempt(status, "a", "HTTP 503", false, hours(2));
  assert.equal(status.a.next_attempt_at, hours(10).toISOString());
  const last = recordAttempt(status, "a", "HTTP 503", false, hours(10));
  assert.equal(last.attempts, MAX_ATTEMPTS);
  assert.equal(last.final, true);
  assert.equal(last.next_attempt_at, undefined);
  assert.equal(isDue(status, "a", hours(1000)), false);

  recordAttempt(status, "b", "robots.txt disallows", true, T0);
  assert.equal(status.b.final, true);
  assert.equal(isDue(status, "b", hours(1000)), false);
});

test("status file round-trips with sorted ids and prunes to the keep set", () => {
  const dir = mkdtempSync(join(tmpdir(), "paranews-status-"));
  try {
    const path = join(dir, "status.json");
    const status: StatusFile = {};
    recordAttempt(status, "b", "x", false, T0);
    recordAttempt(status, "a", "y", true, T0);
    saveStatus(status, path);
    const text = readFileSync(path, "utf8");
    assert.ok(text.indexOf('"a"') < text.indexOf('"b"'));
    assert.deepEqual(loadStatus(path), status);
    pruneStatus(status, new Set(["b"]));
    assert.deepEqual(Object.keys(status), ["b"]);
    saveStatus({}, path);
    assert.deepEqual(loadStatus(path), {});
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("articles and images are written and listed; key order is fixed", () => {
  const dir = mkdtempSync(join(tmpdir(), "paranews-articles-"));
  try {
    const articles = join(dir, "articles");
    const images = join(dir, "images");
    const record: ArticleRecord = {
      content: "<p>body</p>",
      id: "0123456789abcdef",
      words: 300,
      title: "T",
      url: "https://x.example/a",
      fetched_at: T0.toISOString(),
      image: { width: 800, height: 450, source: "https://x.example/a.jpg" },
    };
    saveArticle(record, articles);
    saveImage(record.id, Buffer.from("RIFF"), images);
    assert.deepEqual([...archivedIds(articles)], [record.id]);
    assert.deepEqual(loadArticle(record.id, articles), record);
    assert.equal(loadAllArticles(articles).length, 1);
    assert.equal(loadArticle("ffffffffffffffff", articles), undefined);
    const keys = Object.keys(JSON.parse(serializeArticle(record)) as object);
    assert.deepEqual(keys, ["id", "url", "fetched_at", "title", "words", "image", "content"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
