import { XMLParser } from "fast-xml-parser";

export interface RawEntry {
  title: string;
  link: string;
  published?: string;
  summary?: string;
  content?: string;
  image?: string;
  source?: { name: string; url?: string };
  guid?: string;
}

export interface FetchResult {
  /** HTTP status; 0 when the request never got a response. */
  status: number;
  notModified: boolean;
  etag?: string;
  lastModified?: string;
  entries: RawEntry[];
  error?: string;
}

/** Several publishers (NY Post, Reddit) refuse or degrade non-browser user agents. */
export const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export interface FetchOptions {
  etag?: string;
  lastModified?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function fetchFeed(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8",
    "accept-language": "en-US,en;q=0.8",
  };
  if (opts.etag) headers["if-none-match"] = opts.etag;
  if (opts.lastModified) headers["if-modified-since"] = opts.lastModified;

  let attempt = 0;
  for (;;) {
    attempt++;
    let res: Response;
    try {
      res = await doFetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000) });
    } catch (err) {
      if (attempt < 2) {
        await sleep(2000);
        continue;
      }
      return { status: 0, notModified: false, entries: [], error: describe(err) };
    }
    if (res.status === 304) return { status: 304, notModified: true, entries: [] };
    if (res.status >= 500 && attempt < 2) {
      await sleep(2000);
      continue;
    }
    if (!res.ok) return { status: res.status, notModified: false, entries: [], error: `HTTP ${res.status}` };

    const text = await res.text();
    const etag = res.headers.get("etag") ?? undefined;
    const lastModified = res.headers.get("last-modified") ?? undefined;
    try {
      const entries = parseFeed(text);
      return { status: res.status, notModified: false, etag, lastModified, entries };
    } catch (err) {
      // A 200 with an HTML body is the usual shape of a bot wall or a moved feed.
      return { status: res.status, notModified: false, entries: [], error: describe(err) };
    }
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: { code?: string } }).cause;
    return cause?.code ? `${err.message} (${cause.code})` : err.message;
  }
  return String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const ARRAY_PATHS = new Set([
  "rss.channel.item",
  "rss.channel.item.link",
  "rss.channel.item.enclosure",
  "rss.channel.item.media:content",
  "rss.channel.item.media:thumbnail",
  "rss.channel.item.media:group.media:content",
  "rdf:RDF.item",
  "feed.entry",
  "feed.entry.link",
  "feed.entry.media:thumbnail",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  processEntities: true,
  htmlEntities: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (_name, jpath) => ARRAY_PATHS.has(String(jpath)),
});

type Node = string | number | Node[] | { [k: string]: Node } | undefined | null;

/** Parse RSS 2.0, RSS 1.0 (RDF) or Atom. Throws when the document is none of those. */
export function parseFeed(xml: string): RawEntry[] {
  const trimmed = xml.trimStart();
  if (!trimmed.startsWith("<")) throw new Error("not XML");
  const doc = parser.parse(trimmed) as Record<string, Node>;
  if (doc.rss) {
    const channel = obj(obj(doc.rss).channel);
    return arr(channel.item).map(rssItem).filter(hasTitleAndLink);
  }
  if (doc["rdf:RDF"]) {
    return arr(obj(doc["rdf:RDF"]).item).map(rssItem).filter(hasTitleAndLink);
  }
  if (doc.feed) {
    return arr(obj(doc.feed).entry).map(atomEntry).filter(hasTitleAndLink);
  }
  throw new Error(`unrecognized feed root: ${Object.keys(doc).filter((k) => k !== "?xml").join(",") || "empty"}`);
}

function hasTitleAndLink(e: RawEntry): boolean {
  return Boolean(e.title && /^https?:\/\//i.test(e.link));
}

function obj(n: Node): { [k: string]: Node } {
  return n && typeof n === "object" && !Array.isArray(n) ? n : {};
}

function arr(n: Node): Node[] {
  if (n === undefined || n === null) return [];
  return Array.isArray(n) ? n : [n];
}

/** Text content of a node: plain strings, {"#text"} objects, or the first of an array. */
function txt(n: Node): string {
  if (n === undefined || n === null) return "";
  if (typeof n === "string") return n;
  if (typeof n === "number") return String(n);
  if (Array.isArray(n)) return txt(n[0]);
  const t = n["#text"];
  return typeof t === "string" ? t : typeof t === "number" ? String(t) : "";
}

function attr(n: Node, name: string): string {
  const v = obj(n)[`@_${name}`];
  return typeof v === "string" ? v : "";
}

function rssItem(item: Node): RawEntry {
  const it = obj(item);
  let link = txt(it.link).trim();
  const guid = txt(it.guid).trim();
  if (!link && /^https?:\/\//i.test(guid)) link = guid;
  if (!link) link = attr(arr(it.link)[0], "href");
  const source = it.source ? { name: txt(it.source).trim(), url: attr(it.source, "url") || undefined } : undefined;
  return {
    title: txt(it.title),
    link,
    published: txt(it.pubDate) || txt(it["dc:date"]) || txt(it.published) || undefined,
    summary: txt(it.description) || undefined,
    content: txt(it["content:encoded"]) || undefined,
    image: rssImage(it),
    source: source?.name ? source : undefined,
    guid: guid || undefined,
  };
}

function rssImage(it: { [k: string]: Node }): string | undefined {
  const media = [...arr(it["media:content"]), ...arr(obj(it["media:group"])["media:content"])];
  const images = media.filter((m) => {
    const type = attr(m, "type");
    const medium = attr(m, "medium");
    return medium === "image" || type.startsWith("image/") || (!type && !medium && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(attr(m, "url")));
  });
  images.sort((a, b) => Number(attr(b, "width") || 0) - Number(attr(a, "width") || 0));
  const fromMedia = attr(images[0], "url");
  if (fromMedia) return fromMedia;
  const thumb = attr(arr(it["media:thumbnail"])[0], "url");
  if (thumb) return thumb;
  const enclosure = arr(it.enclosure).find((e) => attr(e, "type").startsWith("image/"));
  const fromEnclosure = attr(enclosure, "url");
  if (fromEnclosure) return fromEnclosure;
  return firstImg(txt(it["content:encoded"]) || txt(it.description));
}

function atomEntry(entry: Node): RawEntry {
  const en = obj(entry);
  const links = arr(en.link);
  const pick =
    links.find((l) => attr(l, "rel") === "alternate" && attr(l, "type").includes("html")) ??
    links.find((l) => attr(l, "rel") === "alternate") ??
    links.find((l) => !attr(l, "rel")) ??
    links[0];
  const content = txt(en.content);
  return {
    title: txt(en.title),
    link: attr(pick, "href") || txt(pick),
    published: txt(en.published) || txt(en.updated) || undefined,
    summary: txt(en.summary) || undefined,
    content: content || undefined,
    image: attr(arr(en["media:thumbnail"])[0], "url") || firstImg(content),
    source: en.source ? { name: txt(obj(en.source).title).trim() } : undefined,
    guid: txt(en.id) || undefined,
  };
}

function firstImg(html: string): string | undefined {
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  return m?.[1];
}
