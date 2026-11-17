// Unit tests for the admin comic form. Run: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseComicForm, slugify, type ComicFormValues } from "./comic-form.ts";

const base: ComicFormValues = {
  title: "Ashen Crown",
  slug: "",
  altTitles: "",
  synopsis: "",
  author: "",
  artist: "",
  status: "ongoing",
  type: "manhwa",
  releaseYear: "",
  genreIds: [],
  isPublished: false,
  isFeatured: false,
  mangaupdatesId: "",
  mangaupdatesUrl: "",
};

test("slugify", () => {
  assert.equal(slugify("The Ninth Gate Warden!"), "the-ninth-gate-warden");
  assert.equal(slugify("  Iron Saint's   Return  "), "iron-saints-return");
  assert.equal(slugify("Café Él"), "cafe-el");
  assert.equal(slugify("아홉 번째 문지기"), "");
  assert.ok(slugify("a".repeat(150)).length <= 100);
});

test("valid form: slug made from title, lists cleaned, empty year allowed", () => {
  const r = parseComicForm({
    ...base,
    altTitles: "Crown of Ash\n\n  Crown of Ash \nAsh Crown",
    synopsis: "Line one\r\nLine two  ",
    genreIds: ["3", "3", "5"],
    isPublished: true,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.slug, "ashen-crown");
  assert.deepEqual(r.data.altTitles, ["Crown of Ash", "Ash Crown"]);
  assert.equal(r.data.synopsis, "Line one\nLine two");
  assert.deepEqual(r.data.genreIds, [3, 5]);
  assert.equal(r.data.releaseYear, null);
  assert.equal(r.data.isPublished, true);
  assert.equal(r.data.mangaupdatesId, null);
});

test("errors are reported per field", () => {
  const r = parseComicForm({
    ...base,
    title: "  ",
    slug: "Bad Slug!",
    status: "deleted",
    type: "novel",
    releaseYear: "20xx",
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.fieldErrors.title, "Enter a title.");
  assert.match(r.fieldErrors.slug ?? "", /lowercase/);
  assert.equal(r.fieldErrors.status, "Pick a status.");
  assert.equal(r.fieldErrors.type, "Pick a type.");
  assert.match(r.fieldErrors.releaseYear ?? "", /4-digit year/);
});

test("non-Latin title needs a hand-written slug", () => {
  const r = parseComicForm({ ...base, title: "아홉 번째 문지기" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.fieldErrors.slug ?? "", /URL name/);
});

test("MangaUpdates link must really be mangaupdates.com", () => {
  const bad = parseComicForm({ ...base, mangaupdatesId: "123", mangaupdatesUrl: "https://evil.example/x" });
  assert.equal(bad.ok, false);
  const good = parseComicForm({ ...base, mangaupdatesId: "123", mangaupdatesUrl: "https://www.mangaupdates.com/series/abc/x" });
  assert.equal(good.ok, true);
  if (good.ok) assert.equal(good.data.mangaupdatesId, 123);
});
