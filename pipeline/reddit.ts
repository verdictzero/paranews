/**
 * Reddit, by the only route Reddit permits.
 *
 * https://www.reddit.com/robots.txt is "User-agent: * / Disallow: /" on every
 * host it serves, .rss included, and Reddit's API rules forbid sending a
 * browser user agent. So the public feeds are off limits; the sanctioned path
 * is an application-only OAuth token, which is what this module implements.
 * Reddit's own block page says as much: "If you're running a script or
 * application, please register or sign in with your developer credentials."
 *
 * Credentials come from the environment (repository secrets in CI). Without
 * them the source is skipped, never failed: a fork with no Reddit app still
 * gets a working site.
 *
 * Rate limit is ~100 requests/minute for an approved free client, so one
 * multi-subreddit listing per run is far inside it.
 */
import type { FetchResult, RawEntry } from "./feeds.ts";
import { describe } from "./feeds.ts";
import { truncate } from "./text.ts";

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API = "https://oauth.reddit.com";
/** Refresh a little before the hour Reddit gives us. */
const TOKEN_SKEW_MS = 60_000;

export interface RedditAuth {
  clientId: string;
  clientSecret: string;
  /** Reddit requires "<platform>:<app id>:<version> (by /u/<user>)" and bans browser-UA spoofing. */
  userAgent: string;
}

export function redditAuthFromEnv(env: Record<string, string | undefined> = process.env): RedditAuth | undefined {
  const clientId = env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = env.REDDIT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return undefined;
  const userAgent = env.REDDIT_USER_AGENT?.trim() || `linux:institute.asr.paranews:v1.0 (by /u/${env.REDDIT_USERNAME?.trim() || "paranews"})`;
  return { clientId, clientSecret, userAgent };
}

interface Token {
  value: string;
  expiresAt: number;
}

let cached: Token | undefined;

/** Test seam: forget the cached bearer token. */
export function resetRedditToken(): void {
  cached = undefined;
}

export async function redditToken(auth: RedditAuth, now: number, fetchImpl: typeof fetch = fetch): Promise<string> {
  if (cached && cached.expiresAt > now) return cached.value;
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(`${auth.clientId}:${auth.clientSecret}`).toString("base64"),
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": auth.userAgent,
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`token HTTP ${res.status}`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("token response carried no access_token");
  cached = { value: body.access_token, expiresAt: now + (body.expires_in ?? 3600) * 1000 - TOKEN_SKEW_MS };
  return cached.value;
}

/** One request covers several subreddits: /r/a+b+c/new. */
export function listingUrl(subreddits: string[], limit = 50): string {
  return `${API}/r/${subreddits.join("+")}/new?limit=${limit}&raw_json=1`;
}

export interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  permalink: string;
  url: string;
  is_self: boolean;
  score: number;
  num_comments: number;
  created_utc: number;
  author: string;
  selftext?: string;
  link_flair_text?: string;
  over_18: boolean;
  stickied: boolean;
  thumbnail?: string;
  domain?: string;
}

interface Listing {
  data?: { children?: { data?: Record<string, unknown> }[] };
}

export function parseListing(json: unknown): RedditPost[] {
  const children = (json as Listing)?.data?.children;
  if (!Array.isArray(children)) return [];
  const out: RedditPost[] = [];
  for (const child of children) {
    const d = child?.data;
    if (!d || typeof d.title !== "string" || typeof d.permalink !== "string") continue;
    out.push({
      id: String(d.id ?? ""),
      title: d.title,
      subreddit: String(d.subreddit ?? ""),
      permalink: `https://www.reddit.com${d.permalink}`,
      url: typeof d.url === "string" ? d.url : `https://www.reddit.com${d.permalink}`,
      is_self: Boolean(d.is_self),
      score: Number(d.score ?? 0),
      num_comments: Number(d.num_comments ?? 0),
      created_utc: Number(d.created_utc ?? 0),
      author: String(d.author ?? ""),
      selftext: typeof d.selftext === "string" ? d.selftext : undefined,
      link_flair_text: typeof d.link_flair_text === "string" ? d.link_flair_text : undefined,
      over_18: Boolean(d.over_18),
      stickied: Boolean(d.stickied),
      thumbnail: typeof d.thumbnail === "string" && /^https:\/\//.test(d.thumbnail) ? d.thumbnail : undefined,
      domain: typeof d.domain === "string" ? d.domain : undefined,
    });
  }
  return out;
}

/**
 * Reddit titles are frequently a fragment addressed to the room ("What is
 * this?", "Any ideas?") rather than a claim about the world. A title carries a
 * story when it is a full sentence's worth of words and either names something
 * specific or is not framed as a question.
 */
const FRAGMENT = /^(?:what|who|why|how|where|when|is|are|was|does|did|can|could|has|have|anyone|any|thoughts|help|need help|looking for|does anyone|can anyone)\b/i;

export function carriesStory(title: string): boolean {
  const words = title.trim().split(/\s+/);
  if (words.length < 5) return false;
  const specific = /\d/.test(title) || words.slice(1).some((w) => /^[A-Z][a-z]{2,}/.test(w));
  return specific || !FRAGMENT.test(title);
}

export interface RedditGate {
  /** Minimum score for a post that links out. */
  minScore?: number;
  /** Minimum score for a self post, which is one person's claim and nothing more. */
  minSelfScore?: number;
  /** Keep only these flairs when the subreddit uses them. */
  flairs?: string[];
}

const DEFAULT_GATE: Required<Pick<RedditGate, "minScore" | "minSelfScore">> = { minScore: 25, minSelfScore: 250 };

/**
 * A subreddit's new queue is mostly one-line anecdotes. Keep posts the
 * community has actually endorsed, and hold self posts to a far higher bar
 * than posts that link to a publisher.
 */
export function keepPost(post: RedditPost, gate: RedditGate = {}): boolean {
  if (post.stickied || post.over_18) return false;
  if (!post.title || !carriesStory(post.title)) return false;
  if (post.author === "[deleted]" || post.author === "AutoModerator") return false;
  if (gate.flairs?.length) {
    const flair = post.link_flair_text?.toLowerCase() ?? "";
    if (!gate.flairs.some((f) => flair.includes(f.toLowerCase()))) return false;
  }
  const min = post.is_self ? (gate.minSelfScore ?? DEFAULT_GATE.minSelfScore) : (gate.minScore ?? DEFAULT_GATE.minScore);
  return post.score >= min;
}

/**
 * A post that links to a publisher IS that publisher's story, found by Reddit;
 * the item points at the article and is graded by the outlet's own tier. A self
 * post is the poster's claim, so it stays on Reddit and stays unverified.
 */
export function toEntry(post: RedditPost): RawEntry {
  const external = !post.is_self && /^https?:\/\//i.test(post.url) && !/^https?:\/\/(?:www\.)?reddit\.com/i.test(post.url);
  const name = external ? (post.domain ?? "").replace(/^self\./, "") || `r/${post.subreddit}` : `r/${post.subreddit}`;
  return {
    title: post.title,
    link: external ? post.url : post.permalink,
    published: new Date(post.created_utc * 1000).toISOString(),
    summary: post.selftext ? truncate(post.selftext.replace(/\s+/g, " ").trim(), 400) : undefined,
    image: post.thumbnail,
    source: { name, url: external ? undefined : `https://www.reddit.com/r/${post.subreddit}` },
    guid: post.id,
  };
}

export interface RedditFetchOptions {
  auth: RedditAuth;
  gate?: RedditGate;
  limit?: number;
  now?: number;
  fetchImpl?: typeof fetch;
}

export async function fetchReddit(subreddits: string[], opts: RedditFetchOptions): Promise<FetchResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now();
  try {
    const token = await redditToken(opts.auth, now, fetchImpl);
    const res = await fetchImpl(listingUrl(subreddits, opts.limit ?? 50), {
      headers: { authorization: `bearer ${token}`, "user-agent": opts.auth.userAgent, accept: "application/json" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      // A stale token is the one error worth one retry.
      if (res.status === 401) resetRedditToken();
      return { status: res.status, notModified: false, entries: [], error: `HTTP ${res.status}` };
    }
    const posts = parseListing(await res.json());
    const entries = posts.filter((p) => keepPost(p, opts.gate)).map(toEntry);
    return { status: res.status, notModified: false, entries };
  } catch (err) {
    return { status: 0, notModified: false, entries: [], error: describe(err) };
  }
}
