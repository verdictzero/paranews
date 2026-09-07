import { test } from "node:test";
import assert from "node:assert/strict";
import { batchBody, embeddedUrl, googleNewsArticleId, parseBatchResponse, parseDecodeParams, resolveGoogleNewsUrl } from "./gnews.ts";

const NEW_ID =
  "CBMijgFBVV95cUxNQi14QTlXeWVSYmt5b0VsZFJkQjJpeDBzV29ZNWRNbzBHaW1tU19fRGppckJ0ZU44Y1Vjc182MUlhVFFZa3kwMndSY2U2bkRRNnllTnFNYjNMYm9mX2pTSUZDNWd2NUs2VldNOFZ3UVo3bHQ5dE1sNEtaT0pscHRJSzhjZ3RJWkFqOW5FV3FR";

/** Build an id the way the older encoder did: header, varint length, URL, trailer. */
function legacyId(url: string): string {
  const u = Buffer.from(url, "utf8");
  const len = u.length < 128 ? Buffer.from([u.length]) : Buffer.from([(u.length & 0x7f) | 0x80, u.length >> 7]);
  return Buffer.concat([Buffer.from([0x08, 0x13, 0x22]), len, u, Buffer.from([0xd2, 0x01, 0x00])]).toString("base64url");
}

test("article id from rss and web forms of the link", () => {
  assert.equal(googleNewsArticleId(`https://news.google.com/rss/articles/${NEW_ID}?oc=5`), NEW_ID);
  assert.equal(googleNewsArticleId(`https://news.google.com/articles/${NEW_ID}`), NEW_ID);
  assert.equal(googleNewsArticleId(`https://news.google.com/read/${NEW_ID}?hl=en-US`), NEW_ID);
  assert.equal(googleNewsArticleId("https://example.com/articles/abc"), undefined);
  assert.equal(googleNewsArticleId("https://news.google.com/topics/CAAqBw"), undefined);
  assert.equal(googleNewsArticleId("not a url"), undefined);
});

test("legacy ids carry the URL; new ids do not", () => {
  const short = "https://example.com/story";
  assert.equal(embeddedUrl(legacyId(short)), short);
  const long = "https://example.com/" + "a".repeat(200);
  assert.equal(embeddedUrl(legacyId(long)), long);
  assert.equal(embeddedUrl(NEW_ID), undefined);
  assert.equal(embeddedUrl("AAAA"), undefined);
  assert.equal(embeddedUrl(""), undefined);
});

test("decode params come from the interstitial's data attributes", () => {
  const html = `<c-wiz><div jscontroller="x" data-n-a-id="${NEW_ID}" data-n-a-sg="Ae5Wzi99_62z" data-n-a-ts="1788755333"></div></c-wiz>`;
  assert.deepEqual(parseDecodeParams(html), { signature: "Ae5Wzi99_62z", timestamp: "1788755333" });
  assert.equal(parseDecodeParams("<html></html>"), undefined);
});

test("batch body is a form-encoded rpc envelope", () => {
  const body = batchBody(NEW_ID, { signature: "sig", timestamp: "123" });
  assert.ok(body.startsWith("f.req="));
  const decoded = JSON.parse(decodeURIComponent(body.slice("f.req=".length))) as unknown[][][];
  assert.equal(decoded[0][0][0], "Fbv4je");
  const inner = JSON.parse(decoded[0][0][1] as string) as unknown[];
  assert.equal(inner[0], "garturlreq");
  assert.equal(inner[2], NEW_ID);
  assert.equal(inner[3], 123);
  assert.equal(inner[4], "sig");
});

test("batch response parsing handles both layouts and rejects junk", () => {
  const single = `)]}'\n\n[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://faroutmagazine.co.uk/2016-movie/\\",1]",null,null,null,"generic"],["di",20],["af.httprm",20,"-8649650623797969479",0]]`;
  assert.equal(parseBatchResponse(single), "https://faroutmagazine.co.uk/2016-movie/");
  const chunked = `)]}'\n\n123\n[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://example.com/a?b=1\\",1]",null,null,null,"generic"]]\n26\n[["di",29],["af.httprm",29,"x",6]]\n`;
  assert.equal(parseBatchResponse(chunked), "https://example.com/a?b=1");
  assert.equal(parseBatchResponse(`)]}'\n\n[["wrb.fr","Fbv4je",null,null,null,[5],"generic"]]`), undefined);
  assert.equal(parseBatchResponse("<html>captcha</html>"), undefined);
});

test("resolve: legacy ids short-circuit, new ids go through both requests, failures are reported", async () => {
  const legacy = `https://news.google.com/rss/articles/${legacyId("https://example.com/x")}?oc=5`;
  assert.deepEqual(await resolveGoogleNewsUrl(legacy, () => Promise.reject(new Error("no network"))), { url: "https://example.com/x" });

  const calls: string[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (url.includes("/rss/articles/")) return new Response(`<div data-n-a-sg="S" data-n-a-ts="7"></div>`, { status: 200 });
    assert.match(String(init?.body), /garturlreq/);
    return new Response(`)]}'\n\n[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://pub.example/story\\",1]",null,null,null,"generic"]]`, { status: 200 });
  };
  assert.deepEqual(await resolveGoogleNewsUrl(`https://news.google.com/rss/articles/${NEW_ID}?oc=5`, fakeFetch), { url: "https://pub.example/story" });
  assert.equal(calls.length, 2);
  assert.ok(calls[1].startsWith("POST https://news.google.com/_/DotsSplashUi/data/batchexecute"));

  const blocked: typeof fetch = async () => new Response("", { status: 429 });
  const r = await resolveGoogleNewsUrl(`https://news.google.com/rss/articles/${NEW_ID}`, blocked);
  assert.equal(r.url, undefined);
  assert.equal(r.status, 429);
  assert.deepEqual(await resolveGoogleNewsUrl("https://example.com/a", blocked), { error: "not a Google News article link" });
});
