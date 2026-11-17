// Turns MangaDex API data into Isfridia comic and chapter fields.
// Pure (no network, no database); used by the sync script and unit-tested in
// map.test.ts.
//
// Chapters: ONLY official ones are kept, meaning chapters MangaDex lists with an
// external URL to the publisher's own site. Chapters hosted on MangaDex are
// fan scanlations and are never stored.

import { toPlainText } from "../mangaupdates/map.ts";

export type ComicStatus = "ongoing" | "completed" | "hiatus" | "cancelled";
export type ComicType = "manhwa" | "manga" | "manhua" | "webcomic";

type LocalizedString = Record<string, string | undefined>;
export type MdTag = { attributes: { name: LocalizedString; group: string } };
export type MdManga = {
  id: string;
  attributes: {
    title: LocalizedString;
    altTitles?: LocalizedString[];
    description?: LocalizedString;
    originalLanguage?: string;
    status?: string | null;
    year?: number | null;
    contentRating?: string;
    tags?: MdTag[];
    links?: Record<string, string> | null;
  };
  relationships?: { type: string; attributes?: { fileName?: string; name?: string } }[];
};
export type MdChapter = {
  id: string;
  attributes: {
    chapter?: string | null;
    title?: string | null;
    externalUrl?: string | null;
    translatedLanguage?: string;
    readableAt?: string;
    publishAt?: string;
    isUnavailable?: boolean;
  };
  relationships?: { type: string; attributes?: { name?: string } }[];
};

export const ALLOWED_RATINGS = new Set(["safe", "suggestive"]);

const ROMANIZED_ORDER = ["en", "ko-ro", "ja-ro", "zh-ro"];

export function pickTitle(m: MdManga): string {
  const { title, altTitles = [] } = m.attributes;
  if (title.en) return title.en.trim();
  for (const lang of ROMANIZED_ORDER) {
    const alt = altTitles.find((t) => t[lang])?.[lang];
    if (alt) return alt.trim();
  }
  return (Object.values(title).find(Boolean) ?? "Untitled").trim();
}

export function altTitlesOf(m: MdManga, chosen: string): string[] {
  const all = [...Object.values(m.attributes.title), ...(m.attributes.altTitles ?? []).flatMap((t) => Object.values(t))];
  const seen = new Set([chosen.toLowerCase()]);
  const out: string[] = [];
  for (const raw of all) {
    const t = (raw ?? "").trim().slice(0, 200);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length === 20) break;
  }
  return out;
}

export function typeFromLanguage(lang: string | undefined): ComicType {
  if (lang === "ko" || lang === "ko-ro") return "manhwa";
  if (lang === "ja" || lang === "ja-ro") return "manga";
  if (lang === "zh" || lang === "zh-hk" || lang === "zh-ro") return "manhua";
  return "webcomic";
}

export function mapStatus(status: string | null | undefined): ComicStatus {
  return status === "completed" || status === "hiatus" || status === "cancelled" ? status : "ongoing";
}

// Genre-group tags become genres (created if new). Theme tags only map onto
// genres the site already has (e.g. "School Life" -> School).
const THEME_TO_EXISTING: Record<string, string> = {
  "school life": "school",
  "martial arts": "martial-arts",
  reincarnation: "reincarnation",
};
export function genresOf(m: MdManga): { genres: string[]; themeSlugs: string[] } {
  const genres: string[] = [];
  const themeSlugs: string[] = [];
  for (const tag of m.attributes.tags ?? []) {
    const name = tag.attributes.name.en?.trim();
    if (!name) continue;
    if (tag.attributes.group === "genre") genres.push(name);
    else if (tag.attributes.group === "theme" && THEME_TO_EXISTING[name.toLowerCase()]) {
      themeSlugs.push(THEME_TO_EXISTING[name.toLowerCase()]);
    }
  }
  return { genres, themeSlugs };
}

// Official places to read or buy. MangaDex link keys: engtl = official English,
// raw = official original-language site, amz/bw/ebj/cdj = stores.
const LINK_LABELS: Record<string, string> = {
  engtl: "Official English",
  raw: "Official original",
  amz: "Amazon",
  bw: "BookWalker",
  ebj: "eBookJapan",
  cdj: "CDJapan",
};
export function officialLinksOf(links: Record<string, string> | null | undefined): Record<string, { label: string; url: string }> {
  const out: Record<string, { label: string; url: string }> = {};
  for (const [key, label] of Object.entries(LINK_LABELS)) {
    const value = links?.[key]?.trim();
    if (!value) continue;
    const url = key === "bw" && !value.startsWith("http") ? `https://bookwalker.jp/${value.replace(/^\//, "")}` : value;
    if (/^https:\/\/[^\s"<>]+$/.test(url)) out[key] = { label, url };
  }
  return out;
}

export function coverKeyOf(m: MdManga): string | null {
  const file = m.relationships?.find((r) => r.type === "cover_art")?.attributes?.fileName;
  return file && /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif)$/i.test(file) ? `md:${m.id}/${file}` : null;
}

export type MappedComic = {
  mangadex_id: string;
  title: string;
  alt_titles: string[];
  synopsis: string;
  status: ComicStatus;
  type: ComicType;
  release_year: number | null;
  cover_key: string | null;
  official_links: Record<string, { label: string; url: string }>;
  genres: string[];
  themeSlugs: string[];
};

// null = skip this title (adult rating).
export function mapManga(m: MdManga): MappedComic | null {
  if (!ALLOWED_RATINGS.has(m.attributes.contentRating ?? "")) return null;
  const title = pickTitle(m).slice(0, 200);
  const year = m.attributes.year;
  return {
    mangadex_id: m.id,
    title,
    alt_titles: altTitlesOf(m, title),
    synopsis: toPlainText(m.attributes.description?.en ?? ""),
    status: mapStatus(m.attributes.status),
    type: typeFromLanguage(m.attributes.originalLanguage),
    release_year: typeof year === "number" && year >= 1900 && year <= 2100 ? year : null,
    cover_key: coverKeyOf(m),
    official_links: officialLinksOf(m.attributes.links),
    ...genresOf(m),
  };
}

// "12" -> 12, "12.5" -> 12.5; anything else (null, "", "Extra") -> null.
export function chapterNumberOf(raw: string | null | undefined): number | null {
  const text = (raw ?? "").trim();
  return /^\d{1,5}(\.\d{1,2})?$/.test(text) ? Number(text) : null;
}

export type MappedChapter = {
  mangadex_id: string;
  number: number;
  title: string | null;
  external_url: string;
  group_name: string | null;
  translated_language: string;
  published_at: string;
};

// Official chapters only, one per chapter number (the earliest release wins).
export function officialChapters(chapters: MdChapter[]): MappedChapter[] {
  const sorted = [...chapters].sort((a, b) =>
    (a.attributes.readableAt ?? a.attributes.publishAt ?? "").localeCompare(b.attributes.readableAt ?? b.attributes.publishAt ?? ""),
  );
  const byNumber = new Map<number, MappedChapter>();
  for (const c of sorted) {
    const url = c.attributes.externalUrl?.trim();
    if (!url || !/^https:\/\/[^\s"<>]+$/.test(url) || c.attributes.isUnavailable) continue;
    const number = chapterNumberOf(c.attributes.chapter);
    if (number === null || byNumber.has(number)) continue;
    const when = c.attributes.readableAt ?? c.attributes.publishAt;
    if (!when || Number.isNaN(Date.parse(when))) continue;
    byNumber.set(number, {
      mangadex_id: c.id,
      number,
      title: c.attributes.title?.trim().slice(0, 200) || null,
      external_url: url,
      group_name: c.relationships?.find((r) => r.type === "scanlation_group")?.attributes?.name?.slice(0, 200) ?? null,
      translated_language: (c.attributes.translatedLanguage ?? "en").slice(0, 12),
      published_at: new Date(when).toISOString(),
    });
  }
  return [...byNumber.values()];
}
