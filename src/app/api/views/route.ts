import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";

// POST /api/views  { "chapterId": "<uuid>" }
// Sent by the reader after someone has read a chapter for a few seconds.
// Counts at most one view per visitor, per chapter, per day (the database
// enforces this). The visitor is identified only by a scrambled code made
// from their network address, a server secret and today's date: it can't be
// turned back into the address and it changes every day.

const body = z.object({ chapterId: z.uuid() });

export async function POST(request: NextRequest) {
  // Only count requests coming from this site's own pages.
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return new Response(null, { status: 403 });

  let parsed;
  try {
    parsed = body.safeParse(JSON.parse(await request.text()));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!parsed.success) return new Response(null, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const day = new Date().toISOString().slice(0, 10);
  const secret = process.env.SUPABASE_SECRET_KEY ?? "";
  const visitor = createHash("sha256").update(`${secret}|${day}|${ip}`).digest("hex");

  const { error } = await createServiceClient().rpc("record_chapter_view", {
    p_chapter_id: parsed.data.chapterId,
    p_visitor_hash: visitor,
  });
  // Never tell the caller whether it counted (nothing to learn from probing).
  return new Response(null, { status: error ? 500 : 204 });
}
