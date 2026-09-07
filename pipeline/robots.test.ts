import { test } from "node:test";
import assert from "node:assert/strict";
import { RobotsCache, parseRobots, robotsAllows } from "./robots.ts";

const SAMPLE = `
# comment
User-agent: Googlebot
Disallow: /google-only/

User-agent: *
Disallow: /private/
Disallow: /tmp
Allow: /private/public.html
Disallow: /*.pdf$
Disallow: /search?

User-agent: Bingbot
User-agent: *
Disallow: /shared-group/
`;

test("parses only the wildcard groups, including grouped agent lines", () => {
  const rules = parseRobots(SAMPLE);
  assert.deepEqual(rules.disallow, ["/private/", "/tmp", "/*.pdf$", "/search?", "/shared-group/"]);
  assert.deepEqual(rules.allow, ["/private/public.html"]);
});

test("longest match wins, ties go to allow, wildcards and anchors work", () => {
  const rules = parseRobots(SAMPLE);
  assert.equal(robotsAllows(rules, "/news/story"), true);
  assert.equal(robotsAllows(rules, "/private/x"), false);
  assert.equal(robotsAllows(rules, "/private/public.html"), true);
  assert.equal(robotsAllows(rules, "/tmpfile"), false);
  assert.equal(robotsAllows(rules, "/docs/a.pdf"), false);
  assert.equal(robotsAllows(rules, "/docs/a.pdf.html"), true);
  assert.equal(robotsAllows(rules, "/search?q=ufo"), false);
  assert.equal(robotsAllows(rules, "/shared-group/a"), false);
  assert.equal(robotsAllows({ allow: [], disallow: ["/"] }, "/anything"), false);
  assert.equal(robotsAllows({ allow: [], disallow: [] }, "/anything"), true);
});

test("cache: one fetch per origin, 4xx allows, 5xx and errors defer", async () => {
  const hits: string[] = [];
  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input);
    hits.push(url);
    if (url.startsWith("https://ok.example")) return new Response("User-agent: *\nDisallow: /no/\n", { status: 200 });
    if (url.startsWith("https://missing.example")) return new Response("", { status: 404 });
    if (url.startsWith("https://down.example")) return new Response("", { status: 503 });
    throw new Error("connection refused");
  };
  const cache = new RobotsCache(fakeFetch);
  assert.equal(await cache.allows("https://ok.example/no/story"), false);
  assert.equal(await cache.allows("https://ok.example/yes/story?x=1"), true);
  assert.equal(await cache.allows("https://missing.example/anything"), true);
  assert.equal(await cache.allows("https://down.example/anything"), false);
  assert.equal(await cache.allows("https://dead.example/anything"), false);
  assert.deepEqual(hits, [
    "https://ok.example/robots.txt",
    "https://missing.example/robots.txt",
    "https://down.example/robots.txt",
    "https://dead.example/robots.txt",
  ]);
});
