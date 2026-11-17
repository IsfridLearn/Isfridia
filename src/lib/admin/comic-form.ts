// Reads and validates the admin comic form. Pure (no database, no Next.js),
// so it is unit-tested in comic-form.test.ts. The server action uses it, so
// nothing the browser sends reaches the database unchecked.

import { z } from "zod";
import { STATUSES, TYPES } from "../catalog/enums.ts";

// "The Ninth Gate Warden!" -> "the-ninth-gate-warden". Accents are dropped
// (é -> e); scripts without Latin letters give "" (the admin types a slug).
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const schema = z.object({
  title: z.string().trim().min(1, { error: "Enter a title." }).max(200, { error: "200 characters at most." }),
  slug: z
    .string()
    .min(1, { error: "Enter a URL name, e.g. my-comic (letters a–z, numbers, hyphens)." })
    .max(100, { error: "100 characters at most." })
    .regex(SLUG, { error: "Use lowercase letters, numbers and single hyphens only." }),
  altTitles: z.array(z.string().max(200, { error: "Each alternative title: 200 characters at most." })).max(20, {
    error: "20 alternative titles at most.",
  }),
  synopsis: z.string().max(5000, { error: "5000 characters at most." }),
  author: z.string().max(120, { error: "120 characters at most." }),
  artist: z.string().max(120, { error: "120 characters at most." }),
  status: z.enum(STATUSES, { error: "Pick a status." }),
  type: z.enum(TYPES, { error: "Pick a type." }),
  releaseYear: z.number().int().min(1900, { error: "Between 1900 and 2100." }).max(2100, { error: "Between 1900 and 2100." }).nullable(),
  genreIds: z.array(z.number().int().positive()).max(30),
  isPublished: z.boolean(),
  isFeatured: z.boolean(),
  mangaupdatesId: z.number().int().positive().nullable(),
  mangaupdatesUrl: z
    .string()
    .regex(/^https:\/\/(www\.)?mangaupdates\.com\//, { error: "Must be a mangaupdates.com link." })
    .max(300)
    .nullable(),
});

export type ComicInput = z.infer<typeof schema>;
export type ComicField = keyof ComicInput;

// What the form shows again after an error, exactly as typed.
export type ComicFormValues = {
  title: string;
  slug: string;
  altTitles: string;
  synopsis: string;
  author: string;
  artist: string;
  status: string;
  type: string;
  releaseYear: string;
  genreIds: string[];
  isPublished: boolean;
  isFeatured: boolean;
  mangaupdatesId: string;
  mangaupdatesUrl: string;
};

type Source = { get(name: string): unknown; getAll(name: string): unknown[] };

const text = (form: Source, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
};

export function readComicForm(form: Source): ComicFormValues {
  return {
    title: text(form, "title"),
    slug: text(form, "slug"),
    altTitles: text(form, "altTitles"),
    synopsis: text(form, "synopsis"),
    author: text(form, "author"),
    artist: text(form, "artist"),
    status: text(form, "status"),
    type: text(form, "type"),
    releaseYear: text(form, "releaseYear"),
    genreIds: form.getAll("genreIds").filter((v): v is string => typeof v === "string"),
    isPublished: form.get("isPublished") === "on",
    isFeatured: form.get("isFeatured") === "on",
    mangaupdatesId: text(form, "mangaupdatesId"),
    mangaupdatesUrl: text(form, "mangaupdatesUrl"),
  };
}

export type ParseResult =
  | { ok: true; data: ComicInput }
  | { ok: false; fieldErrors: Partial<Record<ComicField, string>> };

export function parseComicForm(values: ComicFormValues): ParseResult {
  const title = values.title.trim();
  const year = values.releaseYear.trim();
  const muId = values.mangaupdatesId.trim();
  const candidate = {
    title,
    slug: (values.slug.trim() || slugify(title)).toLowerCase(),
    altTitles: [...new Set(values.altTitles.split("\n").map((t) => t.trim()).filter(Boolean))],
    synopsis: values.synopsis.replace(/\r\n?/g, "\n").trim(),
    author: values.author.trim(),
    artist: values.artist.trim(),
    status: values.status,
    type: values.type,
    releaseYear: year === "" ? null : /^\d{1,4}$/.test(year) ? Number(year) : NaN,
    genreIds: [...new Set(values.genreIds.map(Number))].filter((n) => Number.isInteger(n) && n > 0),
    isPublished: values.isPublished,
    isFeatured: values.isFeatured,
    mangaupdatesId: /^\d{1,15}$/.test(muId) ? Number(muId) : null,
    mangaupdatesUrl: values.mangaupdatesUrl.trim() || null,
  };

  const parsed = schema.safeParse(candidate);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: Partial<Record<ComicField, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as ComicField;
    fieldErrors[key] ??= key === "releaseYear" ? "Enter a 4-digit year between 1900 and 2100, or leave it empty." : issue.message;
  }
  return { ok: false, fieldErrors };
}
