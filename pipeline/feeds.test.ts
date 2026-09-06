import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchFeed, parseFeed } from "./feeds.ts";

const GN = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>"ufo" - Google News</title>
<item><title>Pentagon seeks access to vast private UFO records collection - DefenseScoop</title>
<link>https://news.google.com/rss/articles/CBMiabc?oc=5</link><guid isPermaLink="false">1</guid>
<pubDate>Wed, 02 Sep 2026 20:34:40 GMT</pubDate>
<description>&lt;a href="https://news.google.com/rss/articles/CBMiabc?oc=5"&gt;Pentagon seeks access&lt;/a&gt;&amp;nbsp;&lt;font color="#6f6f6f"&gt;DefenseScoop&lt;/font&gt;</description>
<source url="https://defensescoop.com">DefenseScoop</source></item>
<item><title>Untitled</title></item>
</channel></rss>`;

const WP = `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<item><title><![CDATA[Scientists Just Analyzed 100 UAP Videos & Found This]]></title><link>https://thedebrief.org/uap-videos/</link>
<dc:date>2026-09-03T14:00:00Z</dc:date><description><![CDATA[<p>A short <b>summary</b> of the piece.</p>]]></description>
<content:encoded><![CDATA[<p>Full body</p><img src="https://thedebrief.org/body.jpg">]]></content:encoded>
<media:content url="https://thedebrief.org/small.jpg" medium="image" width="300"/><media:content url="https://thedebrief.org/large.jpg" medium="image" width="1200"/>
</item></channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<title>top scoring links : Paranormal</title><link rel="self" href="https://www.reddit.com/r/Paranormal/top/.rss"/>
<entry><title>Two people say they have seen a little boy in my bedroom.</title>
<link href="https://www.reddit.com/r/Paranormal/comments/abc/two_people/"/>
<updated>2026-09-06T02:00:00+00:00</updated><published>2026-09-06T01:00:00+00:00</published>
<content type="html">&lt;!-- SC_OFF --&gt;&lt;div class="md"&gt;&lt;p&gt;So this happened last night and I cannot sleep.&lt;/p&gt;&lt;/div&gt; submitted by &lt;a href="/u/x"&gt;/u/x&lt;/a&gt; &lt;a href="https://x"&gt;[link]&lt;/a&gt; &lt;a href="https://y"&gt;[comments]&lt;/a&gt;</content>
<media:thumbnail url="https://b.thumbs.redditmedia.com/t.jpg"/>
</entry></feed>`;

test("parses a Google News RSS item with its source element", () => {
  const entries = parseFeed(GN);
  assert.equal(entries.length, 1, "entries without a link are dropped");
  const e = entries[0];
  assert.equal(e.title, "Pentagon seeks access to vast private UFO records collection - DefenseScoop");
  assert.equal(e.link, "https://news.google.com/rss/articles/CBMiabc?oc=5");
  assert.deepEqual(e.source, { name: "DefenseScoop", url: "https://defensescoop.com" });
  assert.equal(e.published, "Wed, 02 Sep 2026 20:34:40 GMT");
  assert.match(e.summary!, /<a href=/);
});

test("parses WordPress RSS with CDATA, dc:date, content:encoded and picks the largest media image", () => {
  const [e] = parseFeed(WP);
  assert.equal(e.title, "Scientists Just Analyzed 100 UAP Videos & Found This");
  assert.equal(e.published, "2026-09-03T14:00:00Z");
  assert.equal(e.image, "https://thedebrief.org/large.jpg");
  assert.match(e.content!, /Full body/);
  assert.match(e.summary!, /<b>summary<\/b>/);
});

test("parses Atom entries with html content and media:thumbnail", () => {
  const [e] = parseFeed(ATOM);
  assert.equal(e.title, "Two people say they have seen a little boy in my bedroom.");
  assert.equal(e.link, "https://www.reddit.com/r/Paranormal/comments/abc/two_people/");
  assert.equal(e.published, "2026-09-06T01:00:00+00:00");
  assert.equal(e.image, "https://b.thumbs.redditmedia.com/t.jpg");
  assert.match(e.content!, /cannot sleep/);
});

test("rejects HTML bodies and unknown roots", () => {
  assert.throws(() => parseFeed("<!doctype html><html><body>404</body></html>"), /unrecognized feed root/);
  assert.throws(() => parseFeed("Just text"), /not XML/);
});

test("fetchFeed sends conditional headers and reports 304 and HTTP errors", async () => {
  const seen: Record<string, string>[] = [];
  const fake = (async (_url: string, init?: RequestInit) => {
    seen.push(init!.headers as Record<string, string>);
    return new Response(null, { status: 304 });
  }) as unknown as typeof fetch;
  const r = await fetchFeed("https://example.com/feed", { etag: '"abc"', lastModified: "Mon, 01 Sep 2026 00:00:00 GMT", fetchImpl: fake });
  assert.equal(r.notModified, true);
  assert.equal(seen[0]["if-none-match"], '"abc"');
  assert.equal(seen[0]["if-modified-since"], "Mon, 01 Sep 2026 00:00:00 GMT");
  assert.match(seen[0]["user-agent"], /Mozilla/);

  const forbidden = (async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
  const f = await fetchFeed("https://example.com/feed", { fetchImpl: forbidden });
  assert.equal(f.status, 403);
  assert.equal(f.error, "HTTP 403");

  const html = (async () => new Response("<html><body>bot wall</body></html>", { status: 200, headers: { etag: '"x"' } })) as unknown as typeof fetch;
  const h = await fetchFeed("https://example.com/feed", { fetchImpl: html });
  assert.equal(h.status, 200);
  assert.match(h.error!, /unrecognized feed root/);
});
