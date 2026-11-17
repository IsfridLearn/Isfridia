import "server-only";

// Writes and deletes files in the "images" storage bucket. Uses the admin's
// own session, so the bucket's rules (admins only) still apply.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const BUCKET = "images";
type Db = SupabaseClient<Database>;

export async function uploadImage(db: Db, path: string, data: Buffer): Promise<void> {
  const { error } = await db.storage.from(BUCKET).upload(path, data, {
    contentType: "image/webp",
    // File names are random and never reused, so browsers and the CDN may
    // keep them for a year.
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(error.message);
}

// Best effort: a leftover file wastes a little space but breaks nothing.
export async function removeImages(db: Db, paths: string[]): Promise<void> {
  if (paths.length) await db.storage.from(BUCKET).remove(paths);
}
