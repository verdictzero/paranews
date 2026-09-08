import { test } from "node:test";
import assert from "node:assert/strict";
import {
  carriesStory, fetchReddit, keepPost, listingUrl, parseListing, redditAuthFromEnv, redditToken, resetRedditToken,
  toEntry, type RedditPost,
} from "./reddit.ts";
import { normalizeEntry } from "./normalize.ts";
import type { SourceConfig } from "./types.ts";

const AUTH = { clientId: "id", clientSecret: "secret", userAgent: "linux:test:v1 (by /u/x)" };
const T0 = Date.parse("2026-09-08T00:00:00Z");

function post(over: Partial<RedditPost> = {}): RedditPost {
  return {
    id: "abc123", title: "Pentagon releases 1967 Malmstrom missile incident file", subreddit: "UFOs",
    permalink: "https://www.reddit.com/r/UFOs/comments/abc123/pentagon/", url: "https://www.theblackvault.com/story",
    is_self: false, score: 400, num_comments: 60, created_utc: T0 / 1000, author: "someone",
    over_18: false, stickied: false, domain: "theblackvault.com", ...over,
  };
}

test("credentials come from the environment, and are optional", () => {
  assert.equal(redditAuthFromEnv({}), undefined);
  assert.equal(redditAuthFromEnv({ REDDIT_CLIENT_ID: "a" }), undefined);
  const auth = redditAuthFromEnv({ REDDIT_CLIENT_ID: "a", REDDIT_CLIENT_SECRET: "b", REDDIT_USERNAME: "me" })!;
  assert.equal(auth.clientId, "a");
  // Reddit bans browser-UA spoofing and requires its own format.
  assert.match(auth.userAgent, /^linux:[\w.]+:v[\d.]+ \(by \/u\/me\)$/);
  assert.doesNotMatch(auth.userAgent, /Mozilla|Chrome/);
  assert.equal(redditAuthFromEnv({ REDDIT_CLIENT_ID: "a", REDDIT_CLIENT_SECRET: "b", REDDIT_USER_AGENT: "custom" })?.userAgent, "custom");
});

test("a title has to carry a proposition, not address the room", () => {
  assert.equal(carriesStory("Pentagon releases 1967 Malmstrom missile incident file"), true);
  assert.equal(carriesStory("Strange craft over Phoenix last night, three witnesses"), true);
  assert.equal(carriesStory("What is this?"), false);
  assert.equal(carriesStory("Any ideas what this could be"), false);
  assert.equal(carriesStory("What was that light over Denver on Tuesday"), true, "names a place, so it is reporting something");
  assert.equal(carriesStory("Saw something weird"), false);
  assert.equal(carriesStory("My grandmother saw a figure in the hallway"), true);
});

test("one request covers several subreddits", () => {
  assert.equal(listingUrl(["UFOs", "UFOB", "ufo"], 50), "https://oauth.reddit.com/r/UFOs+UFOB+ufo/new?limit=50&raw_json=1");
});

test("token is fetched with basic auth and cached until it nears expiry", async () => {
  resetRedditToken();
  let calls = 0;
  const fake: typeof fetch = async (_url, init) => {
    calls++;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    assert.equal(headers.authorization, "Basic " + Buffer.from("id:secret").toString("base64"));
    assert.equal(init?.body, "grant_type=client_credentials");
    assert.equal(headers["user-agent"], AUTH.userAgent);
    return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
  };
  assert.equal(await redditToken(AUTH, T0, fake), "tok");
  assert.equal(await redditToken(AUTH, T0 + 1000, fake), "tok");
  assert.equal(calls, 1, "cached");
  assert.equal(await redditToken(AUTH, T0 + 3600_000, fake), "tok");
  assert.equal(calls, 2, "refreshed near expiry");
  resetRedditToken();
  await assert.rejects(() => redditToken(AUTH, T0, async () => new Response("", { status: 401 })), /token HTTP 401/);
});

test("listing parsing keeps only usable posts and survives junk", () => {
  const json = { data: { children: [
    { data: { title: "A real title here", permalink: "/r/UFOs/comments/a/", id: "a", subreddit: "UFOs", score: 10, created_utc: 1, url: "https://x.example/a", domain: "x.example" } },
    { data: { permalink: "/r/UFOs/comments/b/" } },
    { data: { title: "no permalink" } },
    null,
  ] } };
  const posts = parseListing(json);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].title, "A real title here");
  assert.deepEqual(parseListing({}), []);
  assert.deepEqual(parseListing(null), []);
  assert.deepEqual(parseListing({ data: { children: "nope" } }), []);
});

test("the gate holds self posts to a far higher bar than posts that link out", () => {
  assert.equal(keepPost(post({ score: 25 })), true);
  assert.equal(keepPost(post({ score: 24 })), false);
  // A self post is one person's claim: it needs real community endorsement.
  assert.equal(keepPost(post({ is_self: true, score: 100 })), false);
  assert.equal(keepPost(post({ is_self: true, score: 250 })), true);
  assert.equal(keepPost(post({ stickied: true, score: 9999 })), false);
  assert.equal(keepPost(post({ over_18: true, score: 9999 })), false);
  assert.equal(keepPost(post({ author: "[deleted]", score: 9999 })), false);
  assert.equal(keepPost(post({ title: "What is this?" })), false, "fragment titles carry no story");
  assert.equal(keepPost(post({ title: "Anyone else see it?" })), false);
  assert.equal(keepPost(post({ score: 5 }), { minScore: 5 }), true);
  assert.equal(keepPost(post({ link_flair_text: "Sighting" }), { flairs: ["news", "document"] }), false);
  assert.equal(keepPost(post({ link_flair_text: "News" }), { flairs: ["news", "document"] }), true);
});

test("a post linking to a publisher becomes that publisher's story; a self post stays Reddit's", () => {
  const linked = toEntry(post());
  assert.equal(linked.link, "https://www.theblackvault.com/story", "links to the article, not the thread");
  assert.equal(linked.source?.name, "theblackvault.com");
  assert.equal(linked.published, "2026-09-08T00:00:00.000Z");

  const self = toEntry(post({ is_self: true, url: "https://www.reddit.com/r/UFOs/comments/abc123/pentagon/", selftext: "  I saw   something\n\nlast night. ", domain: "self.UFOs" }));
  assert.equal(self.link, "https://www.reddit.com/r/UFOs/comments/abc123/pentagon/");
  assert.equal(self.source?.name, "r/UFOs");
  assert.equal(self.summary, "I saw something last night.");

  // A post whose "external" link points back at Reddit is still a Reddit post.
  assert.equal(toEntry(post({ url: "https://www.reddit.com/gallery/xyz", domain: "reddit.com" })).source?.name, "r/UFOs");
});

test("normalize grades a Reddit item by the outlet it points to, not by the subreddit", () => {
  const source: SourceConfig = { id: "reddit-ufo", name: "Reddit", kind: "reddit", subreddits: ["UFOs"], tier: "unverified", topics: ["ufo"], enabled: true };
  const now = new Date(T0);
  const linked = normalizeEntry(toEntry(post({ domain: "reuters.com", title: "Pentagon releases 1967 Malmstrom UFO incident file" })), source, now);
  assert.equal(linked?.publisher, "reuters.com");
  assert.equal(linked?.tier, "official", "Reuters is graded as Reuters even though Reddit surfaced it");
  const press = normalizeEntry(toEntry(post({ domain: "npr.org", title: "NPR reports on the 1967 Malmstrom UFO file" })), source, now);
  assert.equal(press?.tier, "press");

  const self = normalizeEntry(toEntry(post({ is_self: true, score: 300, title: "Strange craft over Phoenix last night, three witnesses" })), source, now);
  assert.equal(self?.publisher, "r/UFOs");
  assert.equal(self?.tier, "unverified", "an anonymous claim is never better than unverified");
  assert.equal(self?.feed_id, "reddit-ufo");
});

test("fetchReddit reports failures instead of throwing, and drops a stale token on 401", async () => {
  resetRedditToken();
  const ok: typeof fetch = async (url) =>
    String(url).includes("access_token")
      ? new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 })
      : new Response(JSON.stringify({ data: { children: [{ data: { title: "Pentagon releases the 1967 Malmstrom incident file", permalink: "/r/UFOs/c/", id: "a", subreddit: "UFOs", score: 900, created_utc: T0 / 1000, url: "https://npr.org/a", domain: "npr.org" } }] } }), { status: 200 });
  const good = await fetchReddit(["UFOs"], { auth: AUTH, fetchImpl: ok, now: T0 });
  assert.equal(good.status, 200);
  assert.equal(good.entries.length, 1);

  resetRedditToken();
  const rate: typeof fetch = async (url) =>
    String(url).includes("access_token")
      ? new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 })
      : new Response("", { status: 429 });
  assert.equal((await fetchReddit(["UFOs"], { auth: AUTH, fetchImpl: rate, now: T0 })).error, "HTTP 429");

  resetRedditToken();
  const dead: typeof fetch = async () => { throw new Error("connection refused"); };
  const r = await fetchReddit(["UFOs"], { auth: AUTH, fetchImpl: dead, now: T0 });
  assert.equal(r.status, 0);
  assert.match(r.error ?? "", /connection refused/);
});
