import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeHtml, fetchPage, readCapped } from "./fetch.ts";

test("decodeHtml honours header charset, then meta charset, then utf-8", () => {
  const latin = Buffer.from("caf\xe9", "latin1");
  assert.equal(decodeHtml(latin, "text/html; charset=ISO-8859-1"), "café");
  const meta = Buffer.concat([Buffer.from('<html><head><meta charset="windows-1252"></head>', "latin1"), Buffer.from("\x93quoted\x94", "latin1")]);
  assert.ok(decodeHtml(meta, "text/html").includes("“quoted”"));
  assert.equal(decodeHtml(Buffer.from("héllo", "utf8"), ""), "héllo");
  assert.equal(decodeHtml(Buffer.from("x"), "text/html; charset=not-a-charset"), "x");
});

test("readCapped stops at the cap", async () => {
  const big = new Response("x".repeat(1000));
  assert.equal(await readCapped(big, 100), undefined);
  const small = new Response("hello");
  assert.equal((await readCapped(small, 100))?.toString(), "hello");
  const declared = new Response("hello", { headers: { "content-length": "5000" } });
  assert.equal(await readCapped(declared, 100), undefined);
});

test("fetchPage rejects non-HTML, non-2xx and oversized responses and reports the final URL", async () => {
  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/pdf")) return new Response("%PDF", { status: 200, headers: { "content-type": "application/pdf" } });
    if (url.endsWith("/gone")) return new Response("", { status: 410 });
    if (url.endsWith("/huge")) return new Response("x".repeat(5000), { status: 200, headers: { "content-type": "text/html" } });
    if (url.endsWith("/boom")) throw new Error("socket hang up");
    const res = new Response("<html><body>hi</body></html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    Object.defineProperty(res, "url", { value: "https://final.example/story" });
    return res;
  };
  assert.equal((await fetchPage("https://a.example/pdf", { fetchImpl: fakeFetch })).error, "not HTML (application/pdf)");
  assert.equal((await fetchPage("https://a.example/gone", { fetchImpl: fakeFetch })).status, 410);
  assert.equal((await fetchPage("https://a.example/huge", { fetchImpl: fakeFetch, maxBytes: 100 })).error, "response too large");
  assert.equal((await fetchPage("https://a.example/boom", { fetchImpl: fakeFetch })).status, 0);
  const ok = await fetchPage("https://a.example/story", { fetchImpl: fakeFetch });
  assert.equal(ok.ok, true);
  assert.equal(ok.url, "https://final.example/story");
  assert.ok(ok.html?.includes("hi"));
});
