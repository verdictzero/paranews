import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_WORDS, absoluteHttp, extractArticle, isRepetitive, sanitizeArticle } from "./reader.ts";

const PARA = "Witnesses in the valley described a slow, silent triangle of lights that hung over the ridge for several minutes before it left. ";
const BODY = Array.from({ length: 12 }, (_, i) => `<p>${PARA}Paragraph ${i + 1}.</p>`).join("\n");

function page(extra = "", head = ""): string {
  return `<!doctype html><html lang="en"><head><title>Triangle over the ridge | Valley Times</title>
  <meta property="og:image" content="/img/lead.jpg">
  <meta name="twitter:image" content="https://cdn.example/card.png">
  <meta name="author" content="Jane Reporter">
  <meta property="og:site_name" content="Valley Times">
  <style>.x{color:red}</style>${head}</head>
  <body><nav><a href="/">Home</a> <a href="/about">About</a></nav>
  <article><h1>Triangle over the ridge</h1><p class="byline">By Jane Reporter</p>
  <script>window.track=1</script>
  ${BODY}
  <figure><img src="/img/inline.jpg" width="1200" height="800" alt="the ridge"><figcaption>The ridge at dusk.</figcaption></figure>
  <p>See <a href="/related" onclick="evil()">the follow-up</a> and <a href="javascript:alert(1)">this</a>.</p>
  <img src="https://tracker.example/pixel.gif" width="1" height="1">
  ${extra}
  </article>
  <footer><p>Copyright</p></footer></body></html>`;
}

test("extracts a sanitized article with lead image, byline and word count", () => {
  const out = extractArticle(page(), "https://valleytimes.example/news/triangle");
  assert.ok(out);
  assert.equal(out.title, "Triangle over the ridge");
  assert.equal(out.leadImage, "https://valleytimes.example/img/lead.jpg");
  assert.ok(out.words >= MIN_WORDS);
  assert.ok(out.byline?.includes("Jane Reporter"));
  assert.equal(out.siteName, "Valley Times");
  assert.equal(out.lang, "en");
  assert.ok(out.content.includes("<p>"));
  assert.doesNotMatch(out.content, /<script|onclick|javascript:|class=|<style|<nav|<footer/);
  assert.ok(out.content.includes('href="https://valleytimes.example/related"'), "relative links resolved");
  assert.ok(out.content.includes('rel="noopener nofollow"'));
  assert.ok(out.content.includes('src="https://valleytimes.example/img/inline.jpg"'), "body image kept");
  assert.ok(out.content.includes('referrerpolicy="no-referrer"'));
  assert.doesNotMatch(out.content, /pixel\.gif/, "tracking pixel dropped");
});

test("too little text is not an article", () => {
  const thin = `<html><body><article><h1>Paywall</h1><p>Subscribe to keep reading this story about a UFO.</p></article></body></html>`;
  assert.equal(extractArticle(thin, "https://paywalled.example/x"), undefined);
});

test("without a meta image the first body image becomes the lead and leaves the body", () => {
  const html = page().replace(/<meta property="og:image"[^>]*>/, "").replace(/<meta name="twitter:image"[^>]*>/, "");
  const out = extractArticle(html, "https://valleytimes.example/news/triangle");
  assert.ok(out);
  assert.equal(out.leadImage, "https://valleytimes.example/img/inline.jpg");
  assert.doesNotMatch(out.content, /inline\.jpg/);
  assert.doesNotMatch(out.content, /<figure>\s*<figcaption>/, "orphaned figure removed");
});

test("sanitizer: allowlist, https-only images, skip image, empty blocks removed", () => {
  const dirty = `<div id="readability-page-1"><h1>Big</h1><p></p><p><br></p>
    <p style="color:red" class="lede">Text <b>bold</b> <span data-x="1">span</span> <iframe src="https://evil.example"></iframe></p>
    <img src="http://cdn.example/a.jpg"><img src="data:image/png;base64,AAAA"><img src="https://cdn.example/lead.jpg">
    <h6>tiny heading</h6><table><tr><td colspan="2">cell</td></tr></table></div>`;
  const { content, images } = sanitizeArticle(dirty, "https://site.example/", "https://cdn.example/lead.jpg");
  assert.deepEqual(images, ["https://cdn.example/a.jpg"], "http upgraded, data: dropped, lead skipped");
  assert.ok(content.startsWith("<h2>Big</h2>"));
  assert.doesNotMatch(content, /<div|<span|<iframe|style=|class=|<p><\/p>|<p><br \/><\/p>/);
  assert.ok(content.includes("<h4>tiny heading</h4>"));
  assert.ok(content.includes('<td colspan="2">cell</td>'));
});

test("absoluteHttp resolves and filters schemes", () => {
  assert.equal(absoluteHttp("/a b", "https://x.example/dir/"), "https://x.example/a%20b");
  assert.equal(absoluteHttp("mailto:a@b.c", "https://x.example/"), undefined);
  assert.equal(absoluteHttp("javascript:alert(1)", "https://x.example/"), undefined);
  assert.equal(absoluteHttp("", "https://x.example/"), undefined);
  assert.equal(absoluteHttp("//cdn.example/a.png", "https://x.example/"), "https://cdn.example/a.png");
});

test("a gallery of repeated captions is not an article", () => {
  const caption = "<p>Visitors explore downtown Exeter during the UFO Festival, a Labor Day tradition.</p><p>Grace Chai/Seacoastonline</p>";
  assert.equal(isRepetitive(caption.repeat(8)), true);
  assert.equal(isRepetitive(BODY), false);
  assert.equal(isRepetitive("<p>one paragraph long enough to count</p>"), false);
  const gallery = page().replace(BODY, caption.repeat(8));
  assert.equal(extractArticle(gallery, "https://valleytimes.example/picture-gallery/x"), undefined);
});
