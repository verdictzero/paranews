/**
 * Archive a reader copy of every visible story: resolve the link, fetch the
 * page, keep the readable text and lead image under data/. One copy per
 * story, best outlet first. Failures back off and give up after three tries;
 * the run itself never fails because a publisher did.
 *
 *   --limit N     stories to attempt this run (default 40)
 *   --budget S    seconds to spend before stopping (default 420)
 *   --dry-run     list what would be fetched
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { CACHE_DIR, WINDOW_DAYS } from "../pipeline/config.ts";
import { ShardStore } from "../pipeline/store.ts";
import { buildClusters, dedupeMembers } from "../pipeline/cluster.ts";
import { isVisible, refreshItems } from "../pipeline/visibility.ts";
import { googleNewsArticleId, resolveGoogleNewsUrl } from "../pipeline/gnews.ts";
import { fetchPage } from "../pipeline/fetch.ts";
import { RobotsCache } from "../pipeline/robots.ts";
import { extractArticle } from "../pipeline/reader.ts";
import { fetchImage, thumbnail } from "../pipeline/images.ts";
import { sleep } from "../pipeline/feeds.ts";
import {
  archivedIds, isDue, loadStatus, pruneStatus, recordAttempt, saveArticle, saveImage, saveStatus,
  type ArticleImage, type StatusFile,
} from "../pipeline/articles.ts";
import type { Cluster, Item } from "../pipeline/types.ts";

const args = process.argv.slice(2);
const flag = (name: string, fallback: number): number => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const LIMIT = flag("--limit", 40);
const BUDGET_MS = flag("--budget", 420) * 1000;
const DRY_RUN = args.includes("--dry-run");

/** Google rate-limits the decode endpoint; publishers get a browser's pace. */
const GOOGLE_DELAY_MS = 1500;
const HOST_DELAY_MS = 1000;

/** Pages with nothing reader mode can use. The next outlet in the story is tried instead. */
const NO_READER_HOSTS = new Set([
  "reddit.com", "youtube.com", "youtu.be", "x.com", "twitter.com", "t.co", "facebook.com", "instagram.com",
  "tiktok.com", "threads.net", "bsky.app", "podcasts.apple.com", "open.spotify.com",
]);
/** The same platforms as Google News names them, so no decode is spent finding out. */
const NO_READER_PUBLISHERS = /^(youtube|youtu\.be|t\.co|x\.com|twitter|x|reddit|r\/\S+|facebook|instagram|tiktok|threads|bluesky|spotify|apple podcasts)$/i;

const now = new Date();
const store = new ShardStore();
store.loadWindow(now);
const cutoff = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
const items = refreshItems(store.all().filter((i) => i.published_at >= cutoff));
const byId = new Map(items.map((i) => [i.id, i]));
const clusters = buildClusters(items, { now })
  .filter(isVisible)
  .sort((a, b) => b.latest_published.localeCompare(a.latest_published));
const status: StatusFile = loadStatus();
const archived = archivedIds();

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Galleries, slideshows and video pages: nothing for reader mode, whatever the words say. */
const NO_READER_PATHS = /\/(picture-gallery|gallery|galleries|slideshow|photos|video|videos|watch)\//i;

function fetchable(item: Item): boolean {
  if (NO_READER_PUBLISHERS.test(item.publisher.trim())) return false;
  if (item.url_opaque) return googleNewsArticleId(item.url) !== undefined;
  const host = hostOf(item.url);
  if (!host || [...NO_READER_HOSTS].some((h) => host === h || host.endsWith("." + h))) return false;
  return !NO_READER_PATHS.test(new URL(item.url).pathname);
}

interface Job {
  cluster: Cluster;
  item: Item;
}

const jobs: Job[] = [];
let covered = 0;
for (const c of clusters) {
  const members = dedupeMembers(c.items.map((id) => byId.get(id)!).filter(Boolean));
  if (members.some((m) => archived.has(m.id))) {
    covered++;
    continue;
  }
  const item = members.find((m) => fetchable(m) && isDue(status, m.id, now));
  if (item) jobs.push({ cluster: c, item });
}

if (DRY_RUN) {
  console.log(`${clusters.length} visible stories, ${covered} archived, ${jobs.length} to fetch:`);
  for (const j of jobs.slice(0, LIMIT)) console.log(`  ${j.item.id} ${j.item.url_opaque ? "[gn]" : "[url]"} ${j.item.publisher}: ${j.item.title}`);
  process.exit(0);
}

interface Outcome {
  id: string;
  publisher: string;
  ok: boolean;
  note: string;
}

const outcomes: Outcome[] = [];
const robots = new RobotsCache();
const lastHit = new Map<string, number>();
let resolved = 0;

async function pace(key: string, delay: number): Promise<void> {
  const wait = (lastHit.get(key) ?? 0) + delay - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(key, Date.now());
}

/** Strip campaign parameters; they change per syndication and mean nothing to a reader. */
function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(k)) u.searchParams.delete(k);
    u.hash = "";
    return u.href;
  } catch {
    return url;
  }
}

function fail(item: Item, error: string, final: boolean): Outcome {
  const r = recordAttempt(status, item.id, error, final, now);
  return { id: item.id, publisher: item.publisher, ok: false, note: `${error}${r.final ? " (final)" : ` (attempt ${r.attempts})`}` };
}

async function archive({ item }: Job): Promise<Outcome> {
  let url = item.url;
  if (item.url_opaque) {
    await pace("news.google.com", GOOGLE_DELAY_MS);
    const r = await resolveGoogleNewsUrl(url);
    if (!r.url) return fail(item, `decode: ${r.error}`, false);
    url = cleanUrl(r.url);
    store.patch(item.id, { url, url_opaque: false });
    resolved++;
    if (!fetchable({ ...item, url, url_opaque: false })) return fail(item, `no reader view for ${url}`, true);
  }

  const host = hostOf(url);
  await pace(host, HOST_DELAY_MS);
  if (!(await robots.allows(url))) return fail(item, "robots.txt disallows", true);

  const page = await fetchPage(url);
  // A bot wall or a dead page will not change by tomorrow; try the story's next outlet instead.
  if (!page.ok) return fail(item, page.error ?? `HTTP ${page.status}`, [401, 403, 404, 410, 451].includes(page.status));
  const article = extractArticle(page.html!, page.url);
  if (!article) return fail(item, "no readable article", true);

  let image: ArticleImage | undefined;
  if (article.leadImage) {
    const bytes = await fetchImage(article.leadImage);
    const thumb = bytes && (await thumbnail(bytes));
    if (thumb) {
      saveImage(item.id, thumb.data);
      image = { width: thumb.width, height: thumb.height, source: article.leadImage };
    }
  }

  saveArticle({
    id: item.id,
    url: cleanUrl(page.url),
    fetched_at: now.toISOString(),
    title: article.title || item.title,
    byline: article.byline,
    site_name: article.siteName,
    excerpt: article.excerpt,
    lang: article.lang,
    words: article.words,
    image,
    content: article.content,
  });
  delete status[item.id];
  archived.add(item.id);
  return { id: item.id, publisher: item.publisher, ok: true, note: `${article.words} words${image ? ", image" : ""}` };
}

const started = Date.now();
let attempted = 0;
for (const job of jobs) {
  if (attempted >= LIMIT || Date.now() - started > BUDGET_MS) break;
  attempted++;
  try {
    outcomes.push(await archive(job));
  } catch (err) {
    outcomes.push(fail(job.item, `crash: ${err instanceof Error ? err.message : String(err)}`, false));
  }
}

pruneStatus(status, new Set(items.map((i) => i.id)));
const written = store.save();
saveStatus(status);

const ok = outcomes.filter((o) => o.ok).length;
mkdirSync(CACHE_DIR, { recursive: true });
writeFileSync(
  `${CACHE_DIR}/articles-summary.json`,
  JSON.stringify({ at: now.toISOString(), stories: clusters.length, covered, queued: jobs.length, attempted, archived: ok, resolved, outcomes }, null, 2) + "\n",
);

for (const o of outcomes) console.log(`${o.ok ? "ok  " : "FAIL"} ${o.id} ${o.publisher.padEnd(28).slice(0, 28)} ${o.note}`);
console.log(
  `\n${clusters.length} visible stories: ${covered} already archived, ${jobs.length} queued, ${attempted} attempted, ` +
    `${ok} archived, ${resolved} Google News links resolved, ${written.length} shard(s) updated, ${Math.round((Date.now() - started) / 1000)}s.`,
);
