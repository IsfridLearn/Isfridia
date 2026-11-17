// Unit tests for the MangaUpdates -> Isfridia mapping. Run: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { mapStatus, mapType, matchGenres, toImportDraft, toPlainText, type MuSeries } from "./map.ts";

const OUR_GENRES = [
  { slug: "action", name: "Action" },
  { slug: "fantasy", name: "Fantasy" },
  { slug: "school", name: "School" },
  { slug: "sci-fi", name: "Sci-Fi" },
  { slug: "slice-of-life", name: "Slice of Life" },
];

test("toPlainText strips links, bold, tags and markdown line breaks", () => {
  const input = "From [Yen Press](https://yenpress.com):  \nA **hero** <b>rises</b> &amp; falls.\n\n\n\nThe end.";
  assert.equal(toPlainText(input), "From Yen Press:\nA hero rises & falls.\n\nThe end.");
});

test("toPlainText removes images and caps the length", () => {
  assert.equal(toPlainText("![cover](https://x/y.jpg)Hello"), "Hello");
  const long = toPlainText("a".repeat(6000));
  assert.equal(long.length, 5000);
  assert.ok(long.endsWith("…"));
});

test("toPlainText leaves script-looking text harmless (tags removed)", () => {
  assert.equal(toPlainText('<script>alert("x")</script>Story'), 'alert("x")Story');
});

test("mapStatus", () => {
  assert.equal(mapStatus(true, "200 Chapters (Complete)"), "completed");
  assert.equal(mapStatus(false, "48 Chapters (Ongoing)"), "ongoing");
  assert.equal(mapStatus(false, "12 Chapters (Hiatus)"), "hiatus");
  assert.equal(mapStatus(false, "30 Chapters (Discontinued)"), "cancelled");
  assert.equal(mapStatus(null, null), "ongoing");
});

test("mapType keeps only types Isfridia supports", () => {
  assert.equal(mapType("Manhwa"), "manhwa");
  assert.equal(mapType("Manga"), "manga");
  assert.equal(mapType("Novel"), null);
  assert.equal(mapType(null), null);
});

test("matchGenres matches by name, aliases and reports the rest", () => {
  const result = matchGenres(["Action", "Shounen", "School Life", "Sci-fi", "Slice of Life", "Action"], OUR_GENRES);
  assert.deepEqual(result.slugs, ["action", "school", "sci-fi", "slice-of-life"]);
  assert.deepEqual(result.unmatched, ["Shounen"]);
});

const SERIES: MuSeries = {
  id: 15180124327,
  title: "Solo Leveling",
  url: "https://www.mangaupdates.com/series/6z1uqw7/solo-leveling",
  associated: ["Solo Leveling", "Na Honjaman Level Up", "na honjaman level up", "  "],
  description: "From Yen Press:  \nKnown as the **Weakest** Hunter.",
  type: "Manhwa",
  year: "2018",
  status: "200 Chapters + Prologue (Complete)",
  completed: true,
  genres: ["Action", "Adventure", "Fantasy", "Shounen"],
  authors: [
    { name: "Chugong", type: "Author" },
    { name: "DUBU (Redice Studio)", type: "Artist" },
    { name: "Redice Studio", type: "Artist" },
  ],
};

test("toImportDraft maps a full series", () => {
  const d = toImportDraft(SERIES, OUR_GENRES);
  assert.equal(d.title, "Solo Leveling");
  assert.deepEqual(d.altTitles, ["Na Honjaman Level Up"]); // no duplicates, no title, no blanks
  assert.equal(d.synopsis, "From Yen Press:\nKnown as the Weakest Hunter.");
  assert.equal(d.author, "Chugong");
  assert.equal(d.artist, "DUBU (Redice Studio), Redice Studio");
  assert.equal(d.status, "completed");
  assert.equal(d.type, "manhwa");
  assert.equal(d.releaseYear, 2018);
  assert.deepEqual(d.genreSlugs, ["action", "fantasy"]);
  assert.deepEqual(d.unmatchedGenres, ["Adventure", "Shounen"]);
  assert.equal(d.mangaupdatesUrl, SERIES.url);
  assert.deepEqual(d.missing, []);
});

test("toImportDraft handles missing information gracefully", () => {
  const d = toImportDraft(
    { id: 1, title: "Bare", url: "http://evil.example/x", associated: [], description: "", type: "Novel", year: "unknown", status: null, completed: null, genres: [], authors: [] },
    OUR_GENRES,
  );
  assert.equal(d.synopsis, "");
  assert.equal(d.author, null);
  assert.equal(d.type, null);
  assert.equal(d.typeSource, "Novel");
  assert.equal(d.releaseYear, null);
  assert.equal(d.mangaupdatesUrl, null); // only real mangaupdates.com links are kept
  assert.deepEqual(d.missing, ["synopsis", "author", "artist", "release year", "type", "genres"]);
});
