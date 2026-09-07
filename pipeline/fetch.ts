import { USER_AGENT, describe } from "./feeds.ts";

export interface PageResult {
  ok: boolean;
  status: number;
  /** Final URL after redirects. */
  url: string;
  html?: string;
  contentType?: string;
  error?: string;
}

export interface PageOptions {
  timeoutMs?: number;
  maxBytes?: number;
  fetchImpl?: typeof fetch;
}

const MAX_PAGE_BYTES = 3 * 1024 * 1024;

/** Fetch an HTML page as a browser would, with a hard cap on size and time. */
export async function fetchPage(url: string, opts: PageOptions = {}): Promise<PageResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "accept-language": "en-US,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    });
    const finalUrl = res.url || url;
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return { ok: false, status: res.status, url: finalUrl, contentType, error: `HTTP ${res.status}` };
    }
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      await res.body?.cancel().catch(() => {});
      return { ok: false, status: res.status, url: finalUrl, contentType, error: `not HTML (${contentType.split(";")[0]})` };
    }
    const bytes = await readCapped(res, opts.maxBytes ?? MAX_PAGE_BYTES);
    if (!bytes) return { ok: false, status: res.status, url: finalUrl, contentType, error: "response too large" };
    return { ok: true, status: res.status, url: finalUrl, contentType, html: decodeHtml(bytes, contentType) };
  } catch (err) {
    return { ok: false, status: 0, url, error: describe(err) };
  }
}

/** Read a body up to `max` bytes; undefined when it would exceed that. */
export async function readCapped(res: Response, max: number): Promise<Buffer | undefined> {
  const declared = Number(res.headers.get("content-length"));
  if (declared > max) {
    await res.body?.cancel().catch(() => {});
    return undefined;
  }
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return undefined;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Honour the declared charset (header, then meta tag) instead of assuming UTF-8. */
export function decodeHtml(bytes: Uint8Array, contentType = ""): string {
  const charset = contentType.match(/charset=["']?([\w-]+)/i)?.[1] ?? sniffCharset(bytes) ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function sniffCharset(bytes: Uint8Array): string | undefined {
  const head = Buffer.from(bytes.subarray(0, 4096)).toString("latin1");
  return head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
}
