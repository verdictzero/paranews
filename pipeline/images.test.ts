import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { THUMB_MAX, fetchImage, thumbnail } from "./images.ts";

async function png(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 40, g: 80, b: 120 } } }).png().toBuffer();
}

test("thumbnail downsizes to webp and keeps aspect ratio", async () => {
  const t = await thumbnail(await png(1600, 900));
  assert.ok(t);
  assert.equal(t.width, THUMB_MAX);
  assert.equal(t.height, 450);
  assert.equal((await sharp(t.data).metadata()).format, "webp");
  const small = await thumbnail(await png(500, 300));
  assert.ok(small);
  assert.equal(small.width, 500, "never enlarged");
});

test("icons, banners and junk are rejected", async () => {
  assert.equal(await thumbnail(await png(200, 200)), undefined);
  assert.equal(await thumbnail(await png(1000, 100)), undefined);
  assert.equal(await thumbnail(Buffer.from("not an image")), undefined);
});

test("fetchImage filters by status and type", async () => {
  const bytes = await png(400, 300);
  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith(".svg")) return new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } });
    if (url.endsWith("/html")) return new Response("<html>", { headers: { "content-type": "text/html" } });
    if (url.endsWith("/missing")) return new Response("", { status: 404 });
    return new Response(Uint8Array.from(bytes), { headers: { "content-type": "image/png" } });
  };
  assert.equal(await fetchImage("https://x.example/logo.svg", fakeFetch), undefined);
  assert.equal(await fetchImage("https://x.example/html", fakeFetch), undefined);
  assert.equal(await fetchImage("https://x.example/missing", fakeFetch), undefined);
  assert.equal((await fetchImage("https://x.example/photo.png", fakeFetch))?.length, bytes.length);
});
