// Unit tests for MangaDex -> Isfridia mapping. Run: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { chapterNumberOf, mapManga, officialChapters, officialLinksOf, typeFromLanguage, type MdChapter, type MdManga } from "./map.ts";

const manga = (over: Partial<MdManga["attributes"]> = {}, rels: MdManga["relationships"] = []): MdManga => ({
  id: "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0",
  attributes: {
    title: { "ko-ro": "Na Honjaman Level-Up" },
    altTitles: [{ en: "Solo Leveling" }, { ko: "나 혼자만 레벨업" }, { en: "solo leveling" }],
    description: { en: "10 years ago, **the Gate** opened. [More](https://x.example)" },
    originalLanguage: "ko",
    status: "completed",
    year: 2018,
    contentRating: "safe",
    tags: [
      { attributes: { name: { en: "Action" }, group: "genre" } },
      { attributes: { name: { en: "School Life" }, group: "theme" } },
      { attributes: { name: { en: "Monsters" }, group: "theme" } },
    ],
    links: { engtl: "https://www.webtoons.com/en/x", raw: "https://page.kakao.com/x", al: "105398", bw: "series/123/", amz: "javascript:alert(1)" },
    ...over,
  },
  relationships: rels,
});

test("maps a manhwa: English title, alt titles, plain description, type, genres", () => {
  const m = mapManga(manga({}, [{ type: "cover_art", attributes: { fileName: "e90bdc47-c8b9-4df7-b2c0-17641b645ee1.jpg" } }]));
  assert.ok(m);
  assert.equal(m.title, "Solo Leveling");
  assert.deepEqual(m.alt_titles, ["Na Honjaman Level-Up", "나 혼자만 레벨업"]);
  assert.equal(m.synopsis, "10 years ago, the Gate opened. More");
  assert.equal(m.type, "manhwa");
  assert.equal(m.status, "completed");
  assert.equal(m.release_year, 2018);
  assert.deepEqual(m.genres, ["Action"]);
  assert.deepEqual(m.themeSlugs, ["school"]);
  assert.equal(m.cover_key, "md:32d76d19-8a05-4db0-9fc2-e0b0648fe9d0/e90bdc47-c8b9-4df7-b2c0-17641b645ee1.jpg");
});

test("adult ratings are skipped", () => {
  assert.equal(mapManga(manga({ contentRating: "erotica" })), null);
  assert.equal(mapManga(manga({ contentRating: "pornographic" })), null);
  assert.ok(mapManga(manga({ contentRating: "suggestive" })));
});

test("official links: only official/store keys, only safe https URLs", () => {
  const links = officialLinksOf({ engtl: "https://www.webtoons.com/en/x", al: "105398", bw: "series/123/", amz: "javascript:alert(1)" });
  assert.deepEqual(Object.keys(links).sort(), ["bw", "engtl"]);
  assert.equal(links.bw.url, "https://bookwalker.jp/series/123/");
  assert.equal(links.engtl.label, "Official English");
});

test("type from original language", () => {
  assert.equal(typeFromLanguage("ko"), "manhwa");
  assert.equal(typeFromLanguage("ja"), "manga");
  assert.equal(typeFromLanguage("zh-hk"), "manhua");
  assert.equal(typeFromLanguage("en"), "webcomic");
});

test("chapter numbers", () => {
  assert.equal(chapterNumberOf("12"), 12);
  assert.equal(chapterNumberOf("12.5"), 12.5);
  for (const bad of [null, "", "Extra", "1.234", "-1"]) assert.equal(chapterNumberOf(bad), null);
});

const ch = (id: string, chapter: string | null, externalUrl: string | null, readableAt: string, extra: Partial<MdChapter["attributes"]> = {}): MdChapter => ({
  id,
  attributes: { chapter, externalUrl, readableAt, translatedLanguage: "en", ...extra },
  relationships: [{ type: "scanlation_group", attributes: { name: "Webnovel" } }],
});

test("only official external chapters are kept, one per number, earliest wins", () => {
  const rows = officialChapters([
    ch("a", "2", "https://pub.example/2", "2024-02-01T00:00:00Z"),
    ch("b", "1", "https://pub.example/1", "2024-01-01T00:00:00Z"),
    ch("c", "1", "https://other.example/1", "2024-03-01T00:00:00Z"), // later duplicate
    ch("d", "3", null, "2024-03-01T00:00:00Z"), // hosted on MangaDex = fan scanlation
    ch("e", "4", "http://insecure.example/4", "2024-03-01T00:00:00Z"),
    ch("f", "5", "https://pub.example/5", "2024-03-01T00:00:00Z", { isUnavailable: true }),
    ch("g", "Extra", "https://pub.example/x", "2024-03-01T00:00:00Z"),
  ]);
  assert.deepEqual(rows.map((r) => [r.mangadex_id, r.number]), [["b", 1], ["a", 2]]);
  assert.equal(rows[0].group_name, "Webnovel");
  assert.equal(rows[0].published_at, "2024-01-01T00:00:00.000Z");
});
