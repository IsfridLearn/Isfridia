// Unit tests for chapter web addresses. Run: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { chapterPath, chapterSegment, parseChapterSegment } from "./chapter-path.ts";

test("builds chapter addresses", () => {
  assert.equal(chapterSegment(12), "chapter-12");
  assert.equal(chapterSegment("10.50"), "chapter-10-5");
  assert.equal(chapterSegment(0), "chapter-0");
  assert.equal(chapterPath("ashen-crown", 3.25), "/comics/ashen-crown/chapter-3-25");
});

test("reads chapter addresses back", () => {
  assert.equal(parseChapterSegment("chapter-12"), 12);
  assert.equal(parseChapterSegment("chapter-10-5"), 10.5);
  assert.equal(parseChapterSegment("chapter-3-25"), 3.25);
});

test("rejects anything else, including non-canonical forms", () => {
  for (const bad of ["chapter-", "chapter-abc", "ch-12", "chapter-12.5", "chapter-007", "chapter-1-50", "chapter-1-2-3", "chapter-123456"]) {
    assert.equal(parseChapterSegment(bad), null, bad);
  }
});

test("round-trips", () => {
  for (const n of [0, 1, 9.5, 10.25, 99999.99]) assert.equal(parseChapterSegment(chapterSegment(n)), n);
});
