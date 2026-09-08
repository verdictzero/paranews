/**
 * Resolve rebase conflicts in generated data, so a racing ingest never leaves
 * the workflow stuck mid-rebase.
 *
 * Two runs polling at the same time both write the same shards, and git cannot
 * merge them because it sees two versions of one JSON array. But these files
 * have a merge rule already — the one ShardStore.mergeItem uses — so apply it:
 * items are keyed by id and the first sighting wins, exactly as at ingest.
 *
 * During a rebase, stage 2 ("ours") is the branch being replayed onto — what is
 * already published — and stage 3 ("theirs") is the commit being replayed, this
 * run's fresh data.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { serializeItems } from "../pipeline/store.ts";
import type { Item } from "../pipeline/types.ts";

const git = (...args: string[]): string => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

function stage(n: 2 | 3, path: string): string | undefined {
  try {
    return execFileSync("git", ["show", `:${n}:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return undefined; // Added on only one side.
  }
}

const conflicted = git("diff", "--name-only", "--diff-filter=U").split("\n").filter(Boolean);
if (conflicted.length === 0) {
  console.log("No conflicted paths.");
  process.exit(0);
}

let unioned = 0;
let taken = 0;
for (const path of conflicted) {
  const ours = stage(2, path);
  const theirs = stage(3, path);

  if (/^data\/items\/\d{4}-\d{2}-\d{2}\.json$/.test(path)) {
    const merged = new Map<string, Item>();
    for (const text of [ours, theirs]) {
      if (!text) continue;
      for (const item of JSON.parse(text) as Item[]) {
        const seen = merged.get(item.id);
        // First sighting wins, which is what mergeItem does at ingest.
        if (!seen || item.first_seen_at < seen.first_seen_at) merged.set(item.id, item);
      }
    }
    const items = [...merged.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
    writeFileSync(path, serializeItems(items));
    console.log(`union  ${path} -> ${items.length} items`);
    unioned++;
  } else {
    // Everything else is a record of one run: health, meta, retry state, and the
    // article copies. Take this run's version; it reflects the newer poll, and
    // an article record re-fetched is the same article.
    const text = theirs ?? ours;
    if (text === undefined) throw new Error(`${path}: neither side present`);
    writeFileSync(path, text);
    console.log(`take   ${path}`);
    taken++;
  }
  git("add", "--", path);
}
console.log(`Resolved ${conflicted.length} path(s): ${unioned} unioned, ${taken} taken.`);
