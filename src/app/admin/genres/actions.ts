"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { slugify } from "@/lib/admin/comic-form";
import { adminForAction } from "@/lib/auth/require-admin";

export type GenreFormState = { error?: string; ok?: boolean; submission?: number };

const name = z.string().trim().min(1, { error: "Enter a name." }).max(40, { error: "40 characters at most." });

function done(): GenreFormState {
  updateTag("catalog");
  refresh();
  return { ok: true, submission: Date.now() };
}

const DENIED: GenreFormState = { error: "You don't have permission to do this." };

export async function createGenre(_prev: GenreFormState, formData: FormData): Promise<GenreFormState> {
  const admin = await adminForAction();
  if (!admin) return DENIED;
  const { supabase } = admin;
  const parsed = name.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message, submission: Date.now() };
  const slug = slugify(parsed.data);
  if (!slug) return { error: "Use at least one letter or number (a–z, 0–9).", submission: Date.now() };

  const { error } = await supabase.from("genres").insert({ name: parsed.data, slug });
  if (error?.code === "23505") return { error: "That genre already exists.", submission: Date.now() };
  if (error) return { error: "Could not add the genre.", submission: Date.now() };
  return done();
}

// Renames keep the URL (/genres/slug) so existing links keep working.
export async function renameGenre(_prev: GenreFormState, formData: FormData): Promise<GenreFormState> {
  const admin = await adminForAction();
  if (!admin) return DENIED;
  const { supabase } = admin;
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  const parsed = name.safeParse(formData.get("name"));
  if (!id.success) return { error: "Unknown genre." };
  if (!parsed.success) return { error: parsed.error.issues[0].message, submission: Date.now() };

  const { error } = await supabase.from("genres").update({ name: parsed.data }).eq("id", id.data);
  if (error?.code === "23505") return { error: "Another genre already has that name.", submission: Date.now() };
  if (error) return { error: "Could not rename the genre.", submission: Date.now() };
  return done();
}

// Removes the genre and its links to comics (the comics themselves stay).
export async function deleteGenre(genreId: number): Promise<void> {
  if (!Number.isInteger(genreId) || genreId <= 0) return;
  const admin = await adminForAction();
  if (!admin) return;
  await admin.supabase.from("genres").delete().eq("id", genreId);
  updateTag("catalog");
  refresh();
}
