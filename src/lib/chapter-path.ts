// Chapter web addresses: chapter 12 -> /comics/<slug>/chapter-12,
// chapter 10.5 -> /comics/<slug>/chapter-10-5. Pure; tested in chapter-path.test.ts.

export function chapterSegment(number: number | string): string {
  return `chapter-${String(Number(number)).replace(".", "-")}`;
}

export function chapterPath(comicSlug: string, number: number | string): string {
  return `/comics/${comicSlug}/${chapterSegment(number)}`;
}

// "chapter-10-5" -> 10.5; anything else -> null.
export function parseChapterSegment(segment: string): number | null {
  const m = /^chapter-(\d{1,5})(?:-(\d{1,2}))?$/.exec(segment);
  if (!m) return null;
  const value = Number(m[2] ? `${m[1]}.${m[2]}` : m[1]);
  // Reject non-canonical forms like "chapter-007" or "chapter-1-50".
  return chapterSegment(value) === segment ? value : null;
}
