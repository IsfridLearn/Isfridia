// Turns MangaUpdates series data into Isfridia comic fields.
//
// Pure functions only (no network, no database), so they are unit-tested in
// map.test.ts. Anything MangaUpdates doesn't have becomes empty and is listed
// in `missing`, so the admin form can say what still needs filling in.

export type ComicStatus = "ongoing" | "completed" | "hiatus" | "cancelled";
export type ComicType = "manhwa" | "manga" | "manhua" | "webcomic";

// The parts of a MangaUpdates series we use (see schemas.ts for validation).
export type MuSeries = {
  id: number;
  title: string;
  url: string | null;
  associated: string[];
  description: string;
  type: string | null;
  year: string | null;
  status: string | null;
  completed: boolean | null;
  genres: string[];
  authors: { name: string; type: string }[];
};

export type GenreOption = { slug: string; name: string };

export type ImportDraft = {
  title: string;
  altTitles: string[];
  synopsis: string;
  author: string | null;
  artist: string | null;
  status: ComicStatus;
  type: ComicType | null;
  typeSource: string | null; // MangaUpdates' own label, e.g. "Novel"
  releaseYear: number | null;
  genreSlugs: string[]; // matched to your genres
  unmatchedGenres: string[]; // MangaUpdates genres you don't have
  mangaupdatesId: number;
  mangaupdatesUrl: string | null;
  missing: string[];
};

// Markdown-ish MangaUpdates text -> plain text. React escapes text when it
// renders, so this is about readability, not safety.
export function toPlainText(input: string, maxLength = 5000): string {
  const entities: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
  const text = input
    .replace(/\r\n?/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "") // any HTML tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [text](url) -> text
    .replace(/(\*\*|__)(.+?)\1/g, "$2") // bold
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => entities[m] ?? m)
    .replace(/[ \t]+\n/g, "\n") // trailing spaces used as line breaks
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

export function mapStatus(completed: boolean | null, statusText: string | null): ComicStatus {
  const s = (statusText ?? "").toLowerCase();
  if (/cancel|discontinu|dropped/.test(s)) return "cancelled";
  if (/hiatus/.test(s)) return "hiatus";
  if (completed || /\(complete/.test(s)) return "completed";
  return "ongoing";
}

export function mapType(type: string | null): ComicType | null {
  const t = (type ?? "").trim().toLowerCase();
  return t === "manhwa" || t === "manga" || t === "manhua" ? t : null;
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
// MangaUpdates names that mean one of our genres under a different name.
const ALIASES: Record<string, string> = { schoollife: "school", scifi: "sci-fi" };

export function matchGenres(muGenres: string[], ours: GenreOption[]): { slugs: string[]; unmatched: string[] } {
  const byName = new Map(ours.map((g) => [normalise(g.name), g.slug]));
  const slugs: string[] = [];
  const unmatched: string[] = [];
  for (const name of muGenres) {
    const key = normalise(name);
    const slug = byName.get(key) ?? (ALIASES[key] && ours.some((g) => g.slug === ALIASES[key]) ? ALIASES[key] : undefined);
    if (slug) {
      if (!slugs.includes(slug)) slugs.push(slug);
    } else if (name.trim()) {
      unmatched.push(name.trim());
    }
  }
  return { slugs, unmatched };
}

// "A, B, C" up to maxLength, cut at a name boundary.
function joinNames(names: string[], maxLength = 120): string | null {
  let out = "";
  for (const name of names) {
    const next = out ? `${out}, ${name}` : name;
    if (next.length > maxLength) break;
    out = next;
  }
  return out || null;
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names
    .map((n) => n.trim())
    .filter((n) => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()));
}

export function toImportDraft(series: MuSeries, ourGenres: GenreOption[]): ImportDraft {
  const title = series.title.trim().slice(0, 200);
  const titleKey = title.toLowerCase();
  const altTitles = uniqueNames(series.associated)
    .filter((t) => t.toLowerCase() !== titleKey)
    .map((t) => t.slice(0, 200))
    .slice(0, 20);

  const authors = uniqueNames(series.authors.filter((a) => a.type === "Author").map((a) => a.name));
  const artists = uniqueNames(series.authors.filter((a) => a.type === "Artist").map((a) => a.name));
  const year = series.year && /^\d{4}$/.test(series.year.trim()) ? Number(series.year.trim()) : null;
  const releaseYear = year && year >= 1900 && year <= 2100 ? year : null;
  const { slugs, unmatched } = matchGenres(series.genres, ourGenres);
  const synopsis = toPlainText(series.description ?? "");
  const type = mapType(series.type);

  const draft: ImportDraft = {
    title,
    altTitles,
    synopsis,
    author: joinNames(authors),
    artist: joinNames(artists),
    status: mapStatus(series.completed, series.status),
    type,
    typeSource: series.type,
    releaseYear,
    genreSlugs: slugs,
    unmatchedGenres: unmatched,
    mangaupdatesId: series.id,
    mangaupdatesUrl: series.url && /^https:\/\/(www\.)?mangaupdates\.com\//.test(series.url) ? series.url : null,
    missing: [],
  };

  if (!synopsis) draft.missing.push("synopsis");
  if (!draft.author) draft.missing.push("author");
  if (!draft.artist) draft.missing.push("artist");
  if (!releaseYear) draft.missing.push("release year");
  if (!type) draft.missing.push("type");
  if (!slugs.length) draft.missing.push("genres");
  return draft;
}
