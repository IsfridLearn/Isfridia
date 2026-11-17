// Unit tests for cover processing. Run: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { CoverError, processCover } from "./cover.ts";

const image = (width: number, height: number, format: "png" | "jpeg" | "gif" = "png") =>
  sharp({ create: { width, height, channels: 3, background: "#4060a0" } })[format]().toBuffer();

test("a landscape photo becomes 600x900 and 300x450 WebP", async () => {
  const { large, small } = await processCover(await image(1600, 900, "jpeg"));
  const [l, s] = await Promise.all([sharp(large).metadata(), sharp(small).metadata()]);
  assert.equal(l.format, "webp");
  assert.deepEqual([l.width, l.height], [600, 900]);
  assert.equal(s.format, "webp");
  assert.deepEqual([s.width, s.height], [300, 450]);
  assert.ok(large.length < 2 * 1024 * 1024, "fits the 2 MB storage limit");
});

test("rejects files that are not images", async () => {
  await assert.rejects(processCover(Buffer.from("<html>not an image</html>")), CoverError);
});

test("rejects unsupported formats (GIF)", async () => {
  await assert.rejects(processCover(await image(600, 900, "gif")), /JPG, PNG, WebP or AVIF/);
});

test("rejects images that are too small, with their size", async () => {
  await assert.rejects(processCover(await image(200, 280)), /200 x 280/);
});

test("rejects empty and oversized uploads", async () => {
  await assert.rejects(processCover(Buffer.alloc(0)), /Choose an image/);
  await assert.rejects(processCover(Buffer.alloc(4 * 1024 * 1024 + 1)), /larger than 4 MB/);
});
