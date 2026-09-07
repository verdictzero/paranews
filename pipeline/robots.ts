import { USER_AGENT } from "./feeds.ts";

export interface RobotsRules {
  allow: string[];
  disallow: string[];
}

/** Rules from every `User-agent: *` group. A browser UA has no token of its own to look up. */
export function parseRobots(text: string): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [] };
  let applies = false;
  let inAgentBlock = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!inAgentBlock) applies = false;
      if (value === "*") applies = true;
      inAgentBlock = true;
      continue;
    }
    inAgentBlock = false;
    if (!applies || !value) continue;
    if (key === "disallow") rules.disallow.push(value);
    else if (key === "allow") rules.allow.push(value);
  }
  return rules;
}

/** Longest matching rule wins; a tie goes to allow. Supports `*` and a trailing `$`. */
export function robotsAllows(rules: RobotsRules, path: string): boolean {
  let best: { len: number; allow: boolean } | undefined;
  const consider = (patterns: string[], allow: boolean): void => {
    for (const p of patterns) {
      if (!matchRule(p, path)) continue;
      if (!best || p.length > best.len || (p.length === best.len && allow)) best = { len: p.length, allow };
    }
  };
  consider(rules.disallow, false);
  consider(rules.allow, true);
  return best ? best.allow : true;
}

function matchRule(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = "^" + body.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : "");
  return new RegExp(re).test(path);
}

type Fetched = RobotsRules | "unavailable";

/** One robots.txt fetch per origin per run. 5xx and network errors count as "come back later". */
export class RobotsCache {
  private cache = new Map<string, Promise<Fetched>>();
  private fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = fetchImpl;
  }

  async allows(url: string): Promise<boolean> {
    const u = new URL(url);
    const rules = await this.rulesFor(u.origin);
    if (rules === "unavailable") return false;
    return robotsAllows(rules, u.pathname + u.search);
  }

  private rulesFor(origin: string): Promise<Fetched> {
    let p = this.cache.get(origin);
    if (!p) {
      p = this.load(origin);
      this.cache.set(origin, p);
    }
    return p;
  }

  private async load(origin: string): Promise<Fetched> {
    try {
      const res = await this.fetchImpl(`${origin}/robots.txt`, {
        headers: { "user-agent": USER_AGENT, accept: "text/plain,*/*;q=0.5" },
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status >= 500) return "unavailable";
      if (!res.ok) return { allow: [], disallow: [] };
      return parseRobots(await res.text());
    } catch {
      return "unavailable";
    }
  }
}
