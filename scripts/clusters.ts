/**
 * Build clusters from the current window and dump them to .cache/clusters.json
 * for inspection. `--threshold 0.45` overrides the similarity cutoff so the
 * dedup can be tuned against real data; `--hidden` lists what the
 * entertainment filter removed instead of what the site shows.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { CACHE_DIR } from "../pipeline/config.ts";
import { ShardStore } from "../pipeline/store.ts";
import { buildClusters } from "../pipeline/cluster.ts";
import { byScore } from "../pipeline/rank.ts";
import { isVisible, refreshItems } from "../pipeline/visibility.ts";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const threshold = flag("threshold") ? Number(flag("threshold")) : undefined;
const limit = Number(flag("limit") ?? 40);

const now = new Date();
const store = new ShardStore();
store.loadWindow(now);
const items = refreshItems(store.all());
const byId = new Map(items.map((i) => [i.id, i]));
const everything = buildClusters(items, { now, threshold }).sort(byScore);
const visible = everything.filter(isVisible);
const hidden = everything.filter((c) => !isVisible(c));
const showHidden = args.includes("--hidden");
const clusters = showHidden ? hidden : visible;

mkdirSync(CACHE_DIR, { recursive: true });
writeFileSync(`${CACHE_DIR}/clusters.json`, JSON.stringify(visible, null, 2) + "\n");

const multi = visible.filter((c) => c.items.length > 1);
console.log(`${items.length} items -> ${everything.length} clusters, ${visible.length} shown (${multi.length} with 2+ members; largest ${Math.max(0, ...visible.map((c) => c.items.length))}), ${hidden.length} hidden as entertainment`);
console.log(`\n${showHidden ? "Hidden" : "Top"} ${limit} by score:`);
for (const c of clusters.slice(0, limit)) {
  const flags = c.flags.length ? ` [${c.flags.join(",")}]` : "";
  console.log(`\n${c.score.toFixed(3)}  ${c.tier.padEnd(10)} ${c.topics.join("+").padEnd(14)} x${c.items.length} pub=${c.corroboration}/${c.publishers.length}${flags}`);
  console.log(`   ${c.title}`);
  for (const id of c.items.slice(0, 6)) {
    const it = byId.get(id)!;
    if (id === c.items[0]) console.log(`     · ${it.publisher} (${it.tier}) ${it.published_at.slice(0, 16)}`);
    else console.log(`     · ${it.publisher} (${it.tier}) ${it.published_at.slice(0, 16)} — ${it.title.slice(0, 90)}`);
  }
  if (c.items.length > 6) console.log(`     · … ${c.items.length - 6} more`);
}
