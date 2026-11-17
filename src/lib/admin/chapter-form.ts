// Validates the admin chapter form. Pure (no database, no Next.js), so it is
// unit-tested in chapter-form.test.ts.

export type Visibility = "draft" | "now" | "schedule";

export type ChapterInput = {
  number: number;
  title: string | null;
  visibility: Visibility;
  publishAt: string | null; // ISO time, only for "schedule"
};

export type ChapterField = "number" | "title" | "publishAt";

// "12" -> 12, "10.5" -> 10.5. Up to 2 decimals, 0 to 99999.99.
export function parseChapterNumber(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(text)) return null;
  return Number(text);
}

type Source = { get(name: string): unknown };
const text = (form: Source, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
};

export function parseChapterForm(
  form: Source,
): { ok: true; data: ChapterInput } | { ok: false; fieldErrors: Partial<Record<ChapterField, string>> } {
  const fieldErrors: Partial<Record<ChapterField, string>> = {};

  const number = parseChapterNumber(text(form, "number"));
  if (number === null) fieldErrors.number = "Enter a chapter number like 12 or 12.5.";

  const title = text(form, "title").trim();
  if (title.length > 200) fieldErrors.title = "200 characters at most.";

  const rawVisibility = text(form, "visibility");
  const visibility: Visibility = rawVisibility === "now" || rawVisibility === "schedule" ? rawVisibility : "draft";

  let publishAt: string | null = null;
  if (visibility === "schedule") {
    const when = new Date(text(form, "publishAt"));
    if (Number.isNaN(when.getTime())) fieldErrors.publishAt = "Pick a date and time.";
    else if (when.getFullYear() > 2100) fieldErrors.publishAt = "Pick a date before 2100.";
    else publishAt = when.toISOString();
  }

  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  return { ok: true, data: { number: number as number, title: title || null, visibility, publishAt } };
}
