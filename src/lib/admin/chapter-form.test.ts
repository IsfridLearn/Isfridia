// Unit tests for chapter validation, WebP size reading and page planning.
// Run: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { naturalCompare, planPage } from "../images/page-plan.ts";
import { parseWebpSize } from "../images/webp.ts";
import { parseChapterForm, parseChapterNumber } from "./chapter-form.ts";

const form = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });

test("parseChapterNumber accepts whole numbers and up to 2 decimals", () => {
  assert.equal(parseChapterNumber("12"), 12);
  assert.equal(parseChapterNumber(" 10.5 "), 10.5);
  assert.equal(parseChapterNumber("0"), 0);
  for (const bad of ["", "-1", "abc", "10.555", "1e3", "123456", "10,5"]) {
    assert.equal(parseChapterNumber(bad), null, bad);
  }
});

test("chapter form: draft by default, title optional", () => {
  const r = parseChapterForm(form({ number: "3", title: "  " }));
  assert.deepEqual(r, { ok: true, data: { number: 3, title: null, visibility: "draft", publishAt: null } });
});

test("chapter form: schedule needs a valid date and is stored as UTC", () => {
  const ok = parseChapterForm(form({ number: "4", visibility: "schedule", publishAt: "2026-12-01T18:00:00.000+09:00" }));
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.data.publishAt, "2026-12-01T09:00:00.000Z");
  const bad = parseChapterForm(form({ number: "4", visibility: "schedule", publishAt: "soon" }));
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.fieldErrors.publishAt ?? "", /date and time/);
});

test("chapter form: bad number and long title are reported", () => {
  const r = parseChapterForm(form({ number: "x", title: "t".repeat(201), visibility: "now" }));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.fieldErrors.number ?? "", /12\.5/);
    assert.match(r.fieldErrors.title ?? "", /200/);
  }
});

test("parseWebpSize reads real lossy, lossless and alpha WebP files", async () => {
  const make = (w: number, h: number, opts: object, channels: 3 | 4 = 3) =>
    sharp({ create: { width: w, height: h, channels, background: { r: 10, g: 20, b: 30, alpha: 0.5 } } })
      .webp(opts)
      .toBuffer();
  assert.deepEqual(parseWebpSize(await make(800, 1200, { quality: 80 })), { width: 800, height: 1200 });
  assert.deepEqual(parseWebpSize(await make(321, 4567, { lossless: true })), { width: 321, height: 4567 });
  assert.deepEqual(parseWebpSize(await make(640, 480, { quality: 80 }, 4)), { width: 640, height: 480 });
});

test("parseWebpSize rejects non-WebP data", async () => {
  assert.equal(parseWebpSize(new Uint8Array(10)), null);
  assert.equal(parseWebpSize(new TextEncoder().encode("<html>this is not a webp image at all</html>")), null);
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).png().toBuffer();
  assert.equal(parseWebpSize(png), null);
});

test("planPage keeps small pages, shrinks wide ones, splits tall strips evenly", () => {
  assert.deepEqual(planPage(800, 1200), { width: 800, segments: [{ sourceY: 0, sourceHeight: 1200, height: 1200 }] });

  const wide = planPage(2400, 3600);
  assert.equal(wide.width, 1200);
  assert.equal(wide.segments.reduce((s, x) => s + x.height, 0), 1800);

  const strip = planPage(800, 10000);
  assert.equal(strip.segments.length, 4);
  assert.ok(strip.segments.every((s) => s.height <= 3000));
  assert.equal(strip.segments.reduce((s, x) => s + x.height, 0), 10000);
  assert.equal(strip.segments.reduce((s, x) => s + x.sourceHeight, 0), 10000);
  assert.equal(strip.segments[3].sourceY + strip.segments[3].sourceHeight, 10000);
});

test("naturalCompare sorts page files the way people number them", () => {
  const files = ["page10.jpg", "Page2.jpg", "page1.jpg", "page100.jpg", "page9.jpg"];
  assert.deepEqual(files.sort(naturalCompare), ["page1.jpg", "Page2.jpg", "page9.jpg", "page10.jpg", "page100.jpg"]);
});
