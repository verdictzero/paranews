/**
 * The article archive: one reader copy per story under data/articles/, its
 * lead image under data/images/. Copies are kept for good; nothing here is
 * pruned. data/article-status.json remembers failed attempts so a dead link
 * is retried on a backoff and then left alone.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { DATA_DIR } from "./config.ts";

export const ARTICLES_DIR = `${DATA_DIR}/articles`;
export const IMAGES_DIR = `${DATA_DIR}/images`;
export const ARTICLE_STATUS_FILE = `${DATA_DIR}/article-status.json`;

export interface ArticleImage {
  width: number;
  height: number;
  /** Where the image came from. */
  source: string;
}

export interface ArticleRecord {
  /** Item id the copy belongs to. */
  id: string;
  /** Final URL the copy was taken from. */
  url: string;
  fetched_at: string;
  title: string;
  byline?: string;
  site_name?: string;
  excerpt?: string;
  lang?: string;
  words: number;
  /** Present when data/images/<id>.webp exists. */
  image?: ArticleImage;
  /** Sanitized article body. */
  content: string;
}

const ARTICLE_KEYS: (keyof ArticleRecord)[] = [
  "id", "url", "fetched_at", "title", "byline", "site_name", "excerpt", "lang", "words", "image", "content",
];

export interface AttemptRecord {
  attempts: number;
  last_attempt_at: string;
  /** Absent once the record is final. */
  next_attempt_at?: string;
  error: string;
  /** Never retry: robots.txt, a 404, or no article on the page. */
  final?: boolean;
}

export type StatusFile = Record<string, AttemptRecord>;

export const MAX_ATTEMPTS = 3;
/** Hours to wait after the first and second failed attempt. */
const BACKOFF_HOURS = [2, 8];

export function isDue(status: StatusFile, id: string, now: Date): boolean {
  const r = status[id];
  if (!r) return true;
  if (r.final || r.attempts >= MAX_ATTEMPTS) return false;
  return !r.next_attempt_at || r.next_attempt_at <= now.toISOString();
}

export function recordAttempt(status: StatusFile, id: string, error: string, final: boolean, now: Date): AttemptRecord {
  const attempts = (status[id]?.attempts ?? 0) + 1;
  const done = final || attempts >= MAX_ATTEMPTS;
  const record: AttemptRecord = { attempts, last_attempt_at: now.toISOString(), error };
  if (done) record.final = true;
  else record.next_attempt_at = new Date(now.getTime() + BACKOFF_HOURS[attempts - 1] * 3_600_000).toISOString();
  status[id] = record;
  return record;
}

/** Forget attempts for items that left the window or gained a copy. */
export function pruneStatus(status: StatusFile, keep: Set<string>): void {
  for (const id of Object.keys(status)) if (!keep.has(id)) delete status[id];
}

export function loadStatus(path = ARTICLE_STATUS_FILE): StatusFile {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as StatusFile) : {};
}

export function saveStatus(status: StatusFile, path = ARTICLE_STATUS_FILE): void {
  const ids = Object.keys(status).sort();
  const lines = ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(status[id])}`);
  writeFileSync(path, lines.length ? `{\n${lines.join(",\n")}\n}\n` : "{}\n");
}

export function articlePath(id: string, dir = ARTICLES_DIR): string {
  return `${dir}/${id}.json`;
}

export function imagePath(id: string, dir = IMAGES_DIR): string {
  return `${dir}/${id}.webp`;
}

export function archivedIds(dir = ARTICLES_DIR): Set<string> {
  if (!existsSync(dir)) return new Set();
  return new Set(readdirSync(dir).filter((f) => /^[0-9a-f]{16}\.json$/.test(f)).map((f) => f.slice(0, 16)));
}

export function loadArticle(id: string, dir = ARTICLES_DIR): ArticleRecord | undefined {
  const p = articlePath(id, dir);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as ArticleRecord) : undefined;
}

export function loadAllArticles(dir = ARTICLES_DIR): ArticleRecord[] {
  return [...archivedIds(dir)].sort().map((id) => loadArticle(id, dir)!);
}

/** Fixed key order so a re-fetch that changes nothing produces no diff. */
export function serializeArticle(record: ArticleRecord): string {
  const ordered: Record<string, unknown> = {};
  for (const k of ARTICLE_KEYS) if (record[k] !== undefined) ordered[k] = record[k];
  return JSON.stringify(ordered, null, 2) + "\n";
}

export function saveArticle(record: ArticleRecord, dir = ARTICLES_DIR): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(articlePath(record.id, dir), serializeArticle(record));
}

export function saveImage(id: string, data: Buffer, dir = IMAGES_DIR): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(imagePath(id, dir), data);
}
