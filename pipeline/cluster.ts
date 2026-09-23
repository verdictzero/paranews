import type { Cluster, Flag, Item } from "./types.ts";
import { looksLikeDomain, publisherKey, tokens as tokenize } from "./text.ts";
import { bestTier, tierRank } from "./config.ts";
import { sortTopics } from "./normalize.ts";
import { bestTierOf, scoreCluster, writeUps } from "./rank.ts";

export interface ClusterOptions {
  now?: Date;
  /** IDF-weighted Jaccard similarity needed to join two headlines. */
  threshold?: number;
  /** Two items further apart than this are never compared. */
  pairWindowHours?: number;
  /** A cluster may never span more publication time than this. */
  maxSpanHours?: number;
}

/**
 * threshold 0.3 was chosen against a live corpus: every extra merge between
 * 0.5 and 0.3 was a genuine same-story match (paraphrased headlines, celebrity
 * quotes, local stories picked up nationally) and no unrelated stories joined.
 * The ≥2-shared-token rule and the time windows carry the false-positive risk.
 */
const DEFAULTS = { threshold: 0.3, pairWindowHours: 72, maxSpanHours: 7 * 24 };

/**
 * Group items into stories. Pure lexical: IDF-weighted Jaccard over stemmed
 * headline tokens, so shared genre words ("ufo", "sighting") count for little
 * and shared rare words ("pentagon", "1954", "stratton") count for a lot.
 * Union-find with a span guard keeps transitive chains from swallowing a beat.
 */
export function buildClusters(items: Item[], options: ClusterOptions = {}): Cluster[] {
  const now = options.now ?? new Date();
  const threshold = options.threshold ?? DEFAULTS.threshold;
  const pairWindow = (options.pairWindowHours ?? DEFAULTS.pairWindowHours) * 3_600_000;
  const maxSpan = (options.maxSpanHours ?? DEFAULTS.maxSpanHours) * 3_600_000;

  const n = items.length;
  const toks = items.map((it) => tokenize(it.title_norm));
  const times = items.map((it) => Date.parse(it.published_at));

  const df = new Map<string, number>();
  for (const t of toks) for (const w of t) df.set(w, (df.get(w) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [w, d] of df) idf.set(w, Math.log((n + 1) / (d + 1)) + 1);

  // Candidate pairs must share at least one reasonably rare token.
  const maxDf = Math.max(25, Math.ceil(n * 0.02));
  const postings = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    for (const w of toks[i]) {
      if ((df.get(w) ?? 0) > maxDf) continue;
      let p = postings.get(w);
      if (!p) postings.set(w, (p = []));
      p.push(i);
    }
  }

  const parent = Array.from({ length: n }, (_, i) => i);
  const minT = [...times];
  const maxT = [...times];
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const unite = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (Math.max(maxT[ra], maxT[rb]) - Math.min(minT[ra], minT[rb]) > maxSpan) return;
    parent[rb] = ra;
    minT[ra] = Math.min(minT[ra], minT[rb]);
    maxT[ra] = Math.max(maxT[ra], maxT[rb]);
  };

  const byNorm = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    let p = byNorm.get(items[i].title_norm);
    if (!p) byNorm.set(items[i].title_norm, (p = []));
    p.push(i);
  }
  // Identical headlines from different publishers are the same story (wire copy).
  for (const group of byNorm.values()) for (let k = 1; k < group.length; k++) unite(group[0], group[k]);

  for (let i = 0; i < n; i++) {
    const seen = new Set<number>();
    for (const w of toks[i]) {
      const p = postings.get(w);
      if (!p) continue;
      for (const j of p) {
        if (j <= i || seen.has(j)) continue;
        seen.add(j);
        if (Math.abs(times[i] - times[j]) > pairWindow) continue;
        if (find(i) === find(j)) continue;
        if (weightedJaccard(toks[i], toks[j], idf) >= threshold) unite(i, j);
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = []));
    g.push(i);
  }

  const clusters: Cluster[] = [];
  for (const g of groups.values()) clusters.push(makeCluster(g.map((i) => items[i]), now));
  return clusters;
}

/** Σ idf over shared tokens / Σ idf over all tokens; 0 when fewer than two tokens are shared. */
export function weightedJaccard(a: string[], b: string[], idf: Map<string, number>): number {
  const setB = new Set(b);
  let shared = 0;
  let sharedCount = 0;
  let union = 0;
  for (const w of a) {
    const v = idf.get(w) ?? 1;
    union += v;
    if (setB.has(w)) {
      shared += v;
      sharedCount++;
    }
  }
  const setA = new Set(a);
  for (const w of b) if (!setA.has(w)) union += idf.get(w) ?? 1;
  if (sharedCount < 2 || union === 0) return 0;
  return shared / union;
}

/** Broadcast slugs ("RAW: SD: HOTEL NOMINATED") and all-caps headlines make poor cluster titles. */
export function uglyTitle(title: string): boolean {
  return /^(?:raw|watch|video|photos?|live|update|breaking)\s*:/i.test(title) || !/[a-z]/.test(title);
}

/**
 * Best member first: higher tier, then a resolvable link, then a readable
 * headline, then the most recent coverage (the fullest version of a developing
 * story, and the newest entry of a same-outlet series like daily news briefs).
 */
export function memberOrder(a: Item, b: Item): number {
  return (
    tierRank(a.tier) - tierRank(b.tier) ||
    Number(a.url_opaque) - Number(b.url_opaque) ||
    Number(uglyTitle(a.title)) - Number(uglyTitle(b.title)) ||
    Number(looksLikeDomain(a.publisher)) - Number(looksLikeDomain(b.publisher)) ||
    b.published_at.localeCompare(a.published_at) ||
    a.id.localeCompare(b.id)
  );
}

/** One row per outlet-and-headline: Google News lists "KPTV" and "kptv.com" for the same copy. */
export function dedupeMembers(members: Item[]): Item[] {
  const seen = new Set<string>();
  return members.filter((m) => {
    const key = `${publisherKey(m.publisher)}|${m.title_norm}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The cluster's aggregate headline: the one the coverage most agrees on.
 *
 * It used to be the best-tier member's headline, which is whoever happened to
 * rank highest. For the Tehran lights that was "On Cam: Mystery Lights Over
 * Tehran Skies Sparks UFO Buzz; Drone, Aircraft Or Aliens?" — one outlet's
 * kicker standing in for thirty-two write-ups. Scoring each candidate by how
 * much of its vocabulary the other write-ups also used picks the plain version
 * instead, because a kicker, a station name or a local angle is by definition
 * the part nobody else wrote.
 *
 * Consensus decides between equals, it does not outrank them: candidates are
 * the write-ups at the cluster's best tier, so a wire story is never spoken
 * for by a blog that happened to phrase it plainly. Nor is a headline that is
 * not really a headline — a "RAW:" or all-caps shout, a " - video" tag, a
 * roundup or an organisation's own notice. One candidate per write-up, so
 * twenty affiliates carrying one syndicated headline do not vote twenty
 * times. Below three write-ups there is no consensus to find and the best
 * member keeps the headline.
 */
const CONSENSUS_MIN_WRITEUPS = 3;
const CONSENSUS_MIN_TOKENS = 4;

export function consensusTitle(members: Item[]): Item {
  const ranked = [...members].sort(memberOrder);
  const groups = writeUps(members).map((g) => [...g].sort(memberOrder)[0]);
  if (groups.length < CONSENSUS_MIN_WRITEUPS) return ranked[0];

  const toks = groups.map((m) => tokenize(m.title_norm));
  const df = new Map<string, number>();
  for (const t of toks) for (const w of t) df.set(w, (df.get(w) ?? 0) + 1);

  const top = bestTierOf(groups);
  const scored = groups.map((m, i) => ({ m, i, score: agreement(toks[i], df, groups.length) }));
  // A headline whose link cannot be resolved would leave the heading quoting
  // one outlet and linking to another, so an opaque Google News redirect is
  // not eligible while anything else is.
  const usable = scored.filter((s) => s.m.tier === top && !s.m.url_opaque && toks[s.i].length >= CONSENSUS_MIN_TOKENS && speaksForTheGroup(s.m));
  const pool = usable.length ? usable : scored;
  pool.sort((a, b) => b.score - a.score || memberOrder(a.m, b.m));
  return pool[0].m;
}

/** A headline that can stand as the group's, rather than one outlet's packaging of it. */
function speaksForTheGroup(m: Item): boolean {
  return !uglyTitle(m.title) && !/\s[-–—]\s(?:video|watch|photos?|listen|podcast|opinion|analysis)$/i.test(m.title) && !m.flags.some((f) => f === "roundup" || f === "notice");
}

/** Share of the other write-ups using this headline's words, averaged over them. */
function agreement(t: string[], df: Map<string, number>, groups: number): number {
  if (!t.length || groups < 2) return 0;
  let sum = 0;
  for (const w of t) sum += ((df.get(w) ?? 1) - 1) / (groups - 1);
  return sum / t.length;
}

function makeCluster(members: Item[], now: Date): Cluster {
  members.sort(memberOrder);
  const best = members[0];
  const headline = consensusTitle(members);
  const seed = [...members].sort((a, b) => a.published_at.localeCompare(b.published_at) || a.id.localeCompare(b.id))[0];
  const publishers = distinctPublishers(members);
  let corroboration = 0;
  for (const g of writeUps(members)) {
    const t = bestTierOf(g);
    if (t === "official" || t === "press") corroboration++;
  }
  const flags = majorityFlags(members);
  const published = members.map((m) => m.published_at).sort();
  const latest = published[published.length - 1];
  return {
    id: seed.id,
    title: headline.title,
    // The headline's own article, so the heading, the link and the outlet
    // credited under it are all the same piece of writing. A Google News
    // redirect cannot be resolved server-side, so one of those falls back.
    primary: (headline.url_opaque ? (members.find((m) => !m.url_opaque) ?? best) : headline).id,
    items: members.map((m) => m.id),
    publishers,
    tier: bestTier(members.map((m) => m.tier)),
    corroboration,
    topics: sortTopics(members.flatMap((m) => m.topics)),
    flags,
    first_published: published[0],
    latest_published: latest,
    snippet: members.find((m) => m.snippet)?.snippet,
    image: members.find((m) => m.image)?.image,
    score: scoreCluster(members, flags, latest, now),
  };
}

/** Outlets in member order with aliases folded, preferring "KPTV" over "kptv.com" as the display name. */
export function distinctPublishers(members: Item[]): string[] {
  const byKey = new Map<string, string>();
  for (const m of members) {
    const key = publisherKey(m.publisher);
    const current = byKey.get(key);
    if (current === undefined || (looksLikeDomain(current) && !looksLikeDomain(m.publisher))) byKey.set(key, m.publisher);
  }
  return [...byKey.values()];
}

/**
 * A flag sticks to the cluster only when a strict majority of members carry
 * it. One entertainment outlet among two does not hide a story; the other
 * outlet's headline is evidence it is about an event, not a film.
 */
function majorityFlags(members: Item[]): Flag[] {
  const counts = new Map<Flag, number>();
  for (const m of members) for (const f of m.flags) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts].filter(([, c]) => c * 2 > members.length).map(([f]) => f).sort();
}
