// Unit tests for the Trending This Week helpers. Run: npm run test:unit
import assert from "node:assert/strict";
import test from "node:test";
import { readStat } from "../mangadex/stats.ts";
import { formatCount, movementOf, toMode, trendingNote } from "./trending.ts";

test("movementOf: no history means no arrow", () => {
  assert.equal(movementOf(1, null, false), null);
  assert.equal(movementOf(3, 7, false), null);
});

test("movementOf: up, down, same and new entries", () => {
  assert.deepEqual(movementOf(2, 9, true), { kind: "up", by: 7, from: 9 });
  assert.deepEqual(movementOf(5, 1, true), { kind: "down", by: 4, from: 1 });
  assert.deepEqual(movementOf(4, 4, true), { kind: "same" });
  assert.deepEqual(movementOf(6, null, true), { kind: "new" });
});

test("toMode falls back to the honest starting mode", () => {
  assert.equal(toMode("week"), "week");
  assert.equal(toMode("partial"), "partial");
  assert.equal(toMode("starting"), "starting");
  assert.equal(toMode(null), "starting");
  assert.equal(toMode("anything"), "starting");
});

test("trendingNote says what is measured in each mode", () => {
  assert.equal(trendingNote("week", "2026-11-11", "2026-11-18"), "Manhwa that gained the most MangaDex followers, Nov 11 – Nov 18.");
  assert.match(trendingNote("partial", "2026-11-18", "2026-11-20"), /since Nov 18\. A full week of data arrives Nov 25\./);
  assert.match(trendingNote("starting", null, "2026-11-18"), /most-followed manhwa.*starts Nov 25\./);
  assert.doesNotMatch(trendingNote("starting", null, null), /starts/);
});

test("formatCount keeps small numbers exact and shortens big ones", () => {
  assert.equal(formatCount(1234), "1,234");
  assert.equal(formatCount(98_765), "98.8K");
  assert.equal(formatCount(1_250_000), "1.3M");
});

test("readStat accepts only valid MangaDex statistics", () => {
  assert.deepEqual(readStat({ follows: 1200, rating: { bayesian: 8.71 } }), { follows: 1200, rating: 8.71 });
  assert.deepEqual(readStat({ follows: 5, rating: null }), { follows: 5, rating: null });
  assert.deepEqual(readStat({ follows: 5, rating: { bayesian: 42 } }), { follows: 5, rating: null });
  assert.equal(readStat({ follows: -1 }), null);
  assert.equal(readStat({ follows: "12" }), null);
  assert.equal(readStat({ follows: 1.5 }), null);
  assert.equal(readStat(undefined), null);
});
