/**
 * Reader-mode extraction: the same idea as a browser's reader view. Mozilla's
 * Readability picks the article out of the page; sanitize-html reduces it to
 * plain document markup so it can be rendered inside the site safely.
 */
import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import sanitizeHtml from "sanitize-html";
import { cleanTitle, collapseWhitespace, foldPublisher } from "./text.ts";

export interface Extracted {
  title: string;
  byline?: string;
  siteName?: string;
  excerpt?: string;
  lang?: string;
  /** Sanitized article body. */
  content: string;
  words: number;
  /** Best candidate for a lead image: og:image, then the first body image. */
  leadImage?: string;
}

/** Shorter than this is a teaser or a paywall stub, not an article. */
export const MIN_WORDS = 150;

const ALLOWED_TAGS = [
  "p", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "figure", "figcaption", "img", "a",
  "strong", "em", "b", "i", "u", "s", "br", "hr", "pre", "code", "table", "thead", "tbody", "tr",
  "th", "td", "sup", "sub", "cite", "q", "time", "abbr",
];

export function extractArticle(html: string, url: string): Extracted | undefined {
  // Scripts never run under jsdom and stylesheets only slow it down.
  const lean = html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, "").replace(/<style\b[\s\S]*?<\/style\s*>/gi, "");
  const dom = new JSDOM(lean, { url, virtualConsole: new VirtualConsole() });
  try {
    const doc = dom.window.document;
    const metaImage = metaImages(doc, url)[0];
    const docLang = doc.documentElement.getAttribute("lang") ?? undefined;
    const article = new Readability(doc, { charThreshold: 400 }).parse();
    if (!article?.content) return undefined;

    const text = collapseWhitespace(article.textContent ?? "");
    const words = text ? text.split(" ").length : 0;
    if (words < MIN_WORDS) return undefined;
    if (isRepetitive(article.content)) return undefined;

    let { content, images } = sanitizeArticle(article.content, url, metaImage);
    let leadImage = metaImage;
    if (!leadImage && images[0]) {
      // Promote the first body image to the lead and take it out of the body.
      leadImage = images[0];
      ({ content, images } = sanitizeArticle(article.content, url, leadImage));
    }
    if (!content) return undefined;

    const siteName = clean(article.siteName);
    return {
      title: stripSiteSuffix(cleanTitle(article.title ?? ""), siteName, url),
      byline: clean(article.byline)?.replace(/^by\s+/i, ""),
      siteName,
      excerpt: clean(article.excerpt),
      lang: clean(article.lang ?? docLang),
      content,
      words,
      leadImage,
    };
  } finally {
    dom.window.close();
  }
}

/**
 * Readability keeps "Headline | Site" intact for short headlines. Drop the site
 * name when the page says what it is (og:site_name) or it matches the host.
 */
export function stripSiteSuffix(title: string, siteName: string | undefined, url: string): string {
  const m = title.match(/^(.*\S)\s+[|\-–—»:]\s+([^|\-–—»:]+)$/);
  if (!m) return title;
  const suffix = foldPublisher(m[2]);
  const candidates = [siteName ?? ""];
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    candidates.push(host, host.split(".")[0]);
  } catch {
    /* keep going with the site name only */
  }
  return candidates.some((c) => c && foldPublisher(c) === suffix) ? m[1] : title;
}

/** Photo galleries and slideshows read as the same caption and credit over and over. */
export function isRepetitive(html: string): boolean {
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => collapseWhitespace(m[1].replace(/<[^>]+>/g, "")).toLowerCase())
    .filter((t) => t.length > 20);
  if (paragraphs.length < 6) return false;
  return new Set(paragraphs).size / paragraphs.length < 0.6;
}

function clean(s: string | null | undefined): string | undefined {
  const c = s ? collapseWhitespace(s) : "";
  return c || undefined;
}

/** Social-card images in preference order, absolute and http(s) only. */
export function metaImages(doc: Document, base: string): string[] {
  const selectors = [
    'meta[property="og:image:secure_url"]',
    'meta[property="og:image"]',
    'meta[name="og:image"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:src"]',
    'meta[property="twitter:image"]',
    'link[rel="image_src"]',
  ];
  const out: string[] = [];
  for (const s of selectors) {
    for (const el of doc.querySelectorAll(s)) {
      const abs = absoluteHttp(el.getAttribute("content") ?? el.getAttribute("href"), base);
      if (abs && !out.includes(abs)) out.push(abs);
    }
  }
  return out;
}

export interface Sanitized {
  content: string;
  /** Body image URLs in document order. */
  images: string[];
}

/**
 * Reduce Readability's output to plain document markup: no scripts, styles,
 * handlers, classes, ids or iframes; links open in a new tab; images are
 * https-only, lazy and referrer-free. `skipImage` drops one image (the lead)
 * so the body does not repeat the hero.
 */
export function sanitizeArticle(html: string, base: string, skipImage?: string): Sanitized {
  const images: string[] = [];
  let skipped = false;
  const content = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "rel", "target"],
      img: ["src", "alt", "width", "height", "loading", "decoding", "referrerpolicy"],
      th: ["colspan"],
      td: ["colspan"],
      time: ["datetime"],
      abbr: ["title"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    transformTags: {
      h1: "h2",
      h5: "h4",
      h6: "h4",
      a: (tagName, attribs) => {
        const href = absoluteHttp(attribs.href, base);
        const out: Record<string, string> = href ? { href, rel: "noopener nofollow", target: "_blank" } : {};
        return { tagName, attribs: out };
      },
      img: (tagName, attribs) => {
        let src = absoluteHttp(attribs.src || attribs["data-src"], base);
        if (src?.startsWith("http://")) src = "https://" + src.slice("http://".length);
        if (src && skipImage && src === skipImage && !skipped) {
          skipped = true;
          src = undefined;
        }
        if (!src) return { tagName, attribs: {} };
        images.push(src);
        const out: Record<string, string> = { src, alt: attribs.alt ?? "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" };
        if (/^\d+$/.test(attribs.width ?? "")) out.width = attribs.width;
        if (/^\d+$/.test(attribs.height ?? "")) out.height = attribs.height;
        return { tagName, attribs: out };
      },
    },
    exclusiveFilter: (frame) => {
      if (frame.tag === "img") {
        const w = Number(frame.attribs.width);
        const h = Number(frame.attribs.height);
        return !frame.attribs.src || (w > 0 && w < 40) || (h > 0 && h < 40);
      }
      if (["p", "li", "blockquote", "figcaption", "h2", "h3", "h4", "ul", "ol"].includes(frame.tag)) {
        return frame.text.trim() === "" && frame.mediaChildren.length === 0;
      }
      return false;
    },
  });
  // A figure whose image was dropped (lead, tracker, http-only) is just a stray caption.
  const withoutEmptyFigures = content.replace(/<figure>(?:(?!<img)[\s\S])*?<\/figure>/g, "");
  return { content: withoutEmptyFigures.trim(), images };
}

export function absoluteHttp(value: string | null | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    const u = new URL(value.trim(), base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}
