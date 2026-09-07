/**
 * Google News RSS links (news.google.com/rss/articles/CBMi...) are redirects
 * that only resolve in a browser. Two routes to the publisher URL:
 *   1. Older ids embed the URL in the base64 payload.
 *   2. Newer ids carry an opaque token; the interstitial page exposes a
 *      signature and timestamp that the page's own data endpoint accepts.
 * Both are undocumented. Every failure is returned, never thrown, so a change
 * on Google's side degrades to "no reader copy" instead of a broken run.
 */
import { USER_AGENT, describe } from "./feeds.ts";

const BATCH_URL = "https://news.google.com/_/DotsSplashUi/data/batchexecute";

export function googleNewsArticleId(url: string): string | undefined {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return undefined;
  }
  if (u.hostname !== "news.google.com") return undefined;
  return u.pathname.match(/^\/(?:rss\/)?(?:articles|read)\/([A-Za-z0-9_-]+)\/?$/)?.[1];
}

/** Older ids: 0x08 0x13 0x22, a varint length, then the URL itself. Newer ids hold a token here instead. */
export function embeddedUrl(id: string): string | undefined {
  const bytes = Buffer.from(id, "base64url");
  if (bytes.length < 5 || bytes[0] !== 0x08 || bytes[1] !== 0x13 || bytes[2] !== 0x22) return undefined;
  let len = 0;
  let shift = 0;
  let i = 3;
  for (;;) {
    if (i >= bytes.length || shift > 28) return undefined;
    const b = bytes[i++];
    len |= (b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
  }
  const s = bytes.subarray(i, i + len).toString("utf8");
  return /^https?:\/\/\S+$/.test(s) ? s : undefined;
}

export interface DecodeParams {
  signature: string;
  timestamp: string;
}

export function parseDecodeParams(html: string): DecodeParams | undefined {
  const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const timestamp = html.match(/data-n-a-ts="(\d+)"/)?.[1];
  return signature && timestamp ? { signature, timestamp } : undefined;
}

export function batchBody(id: string, p: DecodeParams): string {
  const req =
    `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],` +
    `"X","X",1,[1,1,1],1,1,null,0,0,null,0],${JSON.stringify(id)},${p.timestamp},${JSON.stringify(p.signature)}]`;
  return "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", req, null, "generic"]]]));
}

/** The response is an anti-JSON prefix, then JSON arrays (sometimes separated by length lines). */
export function parseBatchResponse(text: string): string | undefined {
  const body = text.replace(/^\)\]\}'/, "");
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("[")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(t);
    } catch {
      continue;
    }
    const url = findUrl(parsed);
    if (url) return url;
  }
  return body.match(/garturlres\\",\\"(https?:\/\/[^"\\]+)/)?.[1];
}

function findUrl(node: unknown): string | undefined {
  if (!Array.isArray(node)) return undefined;
  if (node[0] === "wrb.fr" && node[1] === "Fbv4je" && typeof node[2] === "string") {
    try {
      const inner = JSON.parse(node[2]) as unknown[];
      if (inner[0] === "garturlres" && typeof inner[1] === "string" && /^https?:\/\//.test(inner[1])) return inner[1];
    } catch {
      /* not the envelope we want */
    }
    return undefined;
  }
  for (const child of node) {
    const u = findUrl(child);
    if (u) return u;
  }
  return undefined;
}

export interface ResolveResult {
  url?: string;
  status?: number;
  error?: string;
}

export async function resolveGoogleNewsUrl(url: string, fetchImpl: typeof fetch = fetch): Promise<ResolveResult> {
  const id = googleNewsArticleId(url);
  if (!id) return { error: "not a Google News article link" };
  const direct = embeddedUrl(id);
  if (direct) return { url: direct };

  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    accept: "text/html,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.8",
  };
  let page: Response;
  try {
    page = await fetchImpl(`https://news.google.com/rss/articles/${id}`, { headers, redirect: "follow", signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    return { error: `interstitial: ${describe(err)}` };
  }
  if (!page.ok) return { status: page.status, error: `interstitial HTTP ${page.status}` };
  const params = parseDecodeParams(await page.text());
  if (!params) return { status: page.status, error: "interstitial carried no decode params" };

  let res: Response;
  try {
    res = await fetchImpl(BATCH_URL, {
      method: "POST",
      headers: { ...headers, "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: batchBody(id, params),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    return { error: `batchexecute: ${describe(err)}` };
  }
  if (!res.ok) return { status: res.status, error: `batchexecute HTTP ${res.status}` };
  const resolved = parseBatchResponse(await res.text());
  if (!resolved) return { status: res.status, error: "batchexecute response carried no URL" };
  return { url: resolved };
}
