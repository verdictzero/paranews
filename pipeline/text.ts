import { createHash } from "node:crypto";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’",
  ldquo: "“", rdquo: "”", hellip: "…", copy: "©",
  reg: "®", trade: "™", deg: "°", pound: "£", euro: "€",
};

/** Decode numeric and the common named HTML entities. Tolerates already-decoded text. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? m;
  });
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Clean a headline: decode entities, unify quotes/dashes, collapse whitespace. */
export function cleanTitle(raw: string): string {
  return collapseWhitespace(
    decodeEntities(raw)
      // Soft hyphens and zero-width characters split words invisibly ("poltergeis\u00ADt").
      .replace(/[\u00AD\u200B-\u200D\uFEFF\u2060]/g, "")
      .replace(/[‘’‚′]/g, "'")
      .replace(/[“”„″]/g, '"')
      .replace(/ /g, " "),
  );
}

/** Google News appends " - Publisher" to every headline. Strip it only when it really is the publisher. */
export function stripPublisherSuffix(title: string, publisher: string): string {
  const idx = title.lastIndexOf(" - ");
  if (idx <= 0) return title;
  const suffix = title.slice(idx + 3);
  if (foldPublisher(suffix) === foldPublisher(publisher)) return title.slice(0, idx).trim();
  return title;
}

/**
 * Identity key for a publisher. Google News lists the same outlet as both
 * "KPTV" and "kptv.com" (or "CBS News" and "cbsnews.com") depending on the
 * edition, so domain-like names lose their TLD and everything loses spacing.
 */
export function publisherKey(name: string): string {
  let n = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "");
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(n)) {
    n = n.replace(/\.(?:co|com|org|net|ac|gov)\.[a-z]{2}$/, "").replace(/\.[a-z]{2,6}$/, "");
  }
  return n.replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "");
}

/** True for names that are really a hostname ("kfvs12.com"). */
export function looksLikeDomain(name: string): boolean {
  return /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(name.trim());
}

export function foldPublisher(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOPWORDS = new Set(
  (
    "a an the and or but if then else of in on at to for from by with without about into onto over under " +
    "is are was were be been being am do does did done have has had having will would shall should can could " +
    "may might must this that these those it its it's he she they them his her their we you your our i me my " +
    "as than so such not no nor only own same too very just also more most much many some any all both each " +
    "few other another again further once here there when where why how what which who whom whose while " +
    "after before during until up down out off above below between through against says say said saying " +
    "new report reports reported reportedly claims claim claimed video watch photo photos pictures see " +
    "amid after latest news update updates breaking exclusive revealed reveals reveal inside"
  ).split(/\s+/),
);

/** Crude English stemmer: enough to make records/record and seeks/seek collide. */
export function stem(w: string): string {
  if (w.length <= 4) return w;
  if (w.endsWith("ies") && w.length > 5) return w.slice(0, -3) + "y";
  if (w.endsWith("ing") && w.length > 6) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 5) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 5) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Lowercased, de-accented, alphanumeric-only headline used for identity hashing. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Content tokens for similarity: stopwords removed, stemmed, deduplicated, order-free. */
export function tokens(title_norm: string): string[] {
  const out = new Set<string>();
  for (const w of title_norm.split(" ")) {
    if (!w || STOPWORDS.has(w)) continue;
    if (w.length < 2 && !/\d/.test(w)) continue;
    out.add(stem(w));
  }
  return [...out];
}

export function itemId(title_norm: string, publisher: string): string {
  return createHash("sha1").update(`${title_norm}|${foldPublisher(publisher)}`).digest("hex").slice(0, 16);
}

/** Truncate at a word boundary with an ellipsis. */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.-]+$/, "") + "…";
}

export function slugify(s: string): string {
  return normalizeTitle(s).replace(/ /g, "-").slice(0, 80).replace(/-+$/, "");
}
