import sharp from "sharp";
import { USER_AGENT } from "./feeds.ts";
import { readCapped } from "./fetch.ts";

/** Longest side of a stored thumbnail. */
export const THUMB_MAX = 800;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export async function fetchImage(url: string, fetchImpl: typeof fetch = fetch): Promise<Buffer | undefined> {
  try {
    const res = await fetchImpl(url, {
      headers: { "user-agent": USER_AGENT, accept: "image/avif,image/webp,image/*;q=0.8,*/*;q=0.5" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return undefined;
    }
    const type = res.headers.get("content-type") ?? "";
    if (/svg/i.test(type) || (type && !/^(image\/|application\/octet-stream)/i.test(type))) {
      await res.body?.cancel().catch(() => {});
      return undefined;
    }
    const bytes = await readCapped(res, MAX_IMAGE_BYTES);
    return bytes?.length ? bytes : undefined;
  } catch {
    return undefined;
  }
}

export interface Thumb {
  data: Buffer;
  width: number;
  height: number;
}

/** Downscaled WebP, or undefined for icons and banners too small to be a photo. */
export async function thumbnail(source: Buffer, max = THUMB_MAX): Promise<Thumb | undefined> {
  try {
    const meta = await sharp(source).metadata();
    if (!meta.width || !meta.height || meta.width < 320 || meta.height < 180) return undefined;
    const { data, info } = await sharp(source, { animated: false })
      .rotate()
      .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    return undefined;
  }
}
