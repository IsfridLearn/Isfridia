// How to turn one uploaded chapter image into the page file(s) we store.
// Pure; tested in page-plan.test.ts. The browser does the actual drawing.
//
// - Pages wider than 1200 px are scaled down to 1200 px (sharp on phones and
//   desktops, small files).
// - Very tall webtoon strips are cut into segments of at most 3000 px, so each
//   file stays small and the reader can load them one by one.

export const MAX_PAGE_WIDTH = 1200;
export const MAX_SEGMENT_HEIGHT = 3000;

export type Segment = { sourceY: number; sourceHeight: number; height: number };
export type PagePlan = { width: number; segments: Segment[] };

export function planPage(sourceWidth: number, sourceHeight: number): PagePlan {
  if (sourceWidth < 1 || sourceHeight < 1) throw new Error("Image has no size.");
  const scale = Math.min(1, MAX_PAGE_WIDTH / sourceWidth);
  const width = Math.round(sourceWidth * scale);
  const totalHeight = Math.max(1, Math.round(sourceHeight * scale));

  const count = Math.ceil(totalHeight / MAX_SEGMENT_HEIGHT);
  const segments: Segment[] = [];
  for (let i = 0; i < count; i++) {
    // Even split, so the last piece isn't a tiny sliver.
    const top = Math.round((totalHeight * i) / count);
    const bottom = Math.round((totalHeight * (i + 1)) / count);
    const sourceY = Math.round(top / scale);
    const sourceEnd = i === count - 1 ? sourceHeight : Math.round(bottom / scale);
    segments.push({ sourceY, sourceHeight: sourceEnd - sourceY, height: bottom - top });
  }
  return { width, segments };
}

// "page2.jpg" before "page10.jpg" (what people expect), case-insensitive.
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
