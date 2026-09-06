import type { Cluster, Flag, Item, Tier } from "./types.ts";

/** How much one publisher at each tier adds to a story's weight. */
export const TIER_WEIGHT: Record<Tier, number> = { official: 6, press: 4, genre: 2, unverified: 0.5 };

/** Multiplicative demotions. Flagged stories stay visible but sink. */
export const FLAG_PENALTY: Record<Flag, number> = { entertainment: 0.25, attraction: 0.5, "weak-match": 0.4 };

/** Hours added to a story's age so brand-new items don't divide by ~zero. */
const AGE_OFFSET_HOURS = 6;

/**
 * Group members by normalized headline. Twenty affiliates running one wire
 * story are one write-up; three newsrooms with their own headlines are three.
 */
export function headlineGroups(members: Item[]): Map<string, Item[]> {
  const groups = new Map<string, Item[]>();
  for (const m of members) groups.set(m.title_norm, [...(groups.get(m.title_norm) ?? []), m]);
  return groups;
}

export function bestTierOf(items: Item[]): Tier {
  return items.reduce((best, m) => (TIER_WEIGHT[m.tier] > TIER_WEIGHT[best] ? m.tier : best), items[0].tier);
}

/**
 * weight × corroboration / age. Weight sums the best tier per independent
 * write-up, so syndicated copies don't inflate a story and five tabloids never
 * outweigh one wire service; more write-ups grow the score logarithmically.
 */
export function scoreCluster(members: Item[], flags: Flag[], latestPublished: string, now: Date): number {
  const groups = headlineGroups(members);
  let weight = 0;
  for (const g of groups.values()) weight += TIER_WEIGHT[bestTierOf(g)];
  const corroboration = 1 + Math.log(groups.size);
  const ageHours = Math.max(0, (now.getTime() - Date.parse(latestPublished)) / 3_600_000);
  let score = (weight * corroboration) / (ageHours + AGE_OFFSET_HOURS);
  for (const f of flags) score *= FLAG_PENALTY[f];
  return score;
}

export function byScore(a: Cluster, b: Cluster): number {
  return b.score - a.score || (a.latest_published < b.latest_published ? 1 : -1);
}

/**
 * Front-page ordering: keep the score order but never let more than `maxRun`
 * consecutive stories share a primary topic, so one loud beat can't fill the page.
 */
export function interleave(clusters: Cluster[], maxRun = 2): Cluster[] {
  const out: Cluster[] = [];
  const pending = [...clusters];
  while (pending.length) {
    const recent = out.slice(-maxRun).map((c) => c.topics[0]);
    const blocked = recent.length === maxRun && recent.every((t) => t === recent[0]) ? recent[0] : undefined;
    const idx = blocked ? pending.findIndex((c) => c.topics[0] !== blocked) : 0;
    out.push(...pending.splice(idx === -1 ? 0 : idx, 1));
  }
  return out;
}
