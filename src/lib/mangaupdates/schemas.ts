// Shapes of the MangaUpdates answers we use, checked with zod. Every field is
// optional with a safe default: MangaUpdates is user-edited and fields are
// often missing, and a missing field must never crash the admin page.

import { z } from "zod";

const str = z.string().catch("");
const nullableStr = z.string().nullable().catch(null);

export const searchResponseSchema = z.object({
  total_hits: z.number().catch(0),
  results: z
    .array(
      z.object({
        hit_title: nullableStr.optional(),
        record: z.object({
          series_id: z.number(),
          title: str,
          url: nullableStr.optional(),
          type: nullableStr.optional(),
          year: nullableStr.optional(),
          description: str.optional(),
          genres: z.array(z.object({ genre: str })).catch([]).optional(),
        }),
      }),
    )
    .catch([]),
});

export const seriesSchema = z.object({
  series_id: z.number(),
  title: str,
  url: nullableStr.optional(),
  associated: z.array(z.object({ title: str })).catch([]).optional(),
  description: str.optional(),
  type: nullableStr.optional(),
  year: nullableStr.optional(),
  status: nullableStr.optional(),
  completed: z.boolean().nullable().catch(null).optional(),
  genres: z.array(z.object({ genre: str })).catch([]).optional(),
  authors: z.array(z.object({ name: str, type: str })).catch([]).optional(),
});
