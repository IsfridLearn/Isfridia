"use server";

// Admin actions for comics. Every action:
//   1. checks the caller is an admin (actions are public URLs, so this is required),
//   2. validates its input,
//   3. writes through the admin's own session, so Row Level Security applies,
//   4. clears the "catalog" cache so the public site shows the change at once.
// The database's audit_log records every change automatically.

import { randomUUID } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseComicForm, readComicForm, type ComicField, type ComicFormValues } from "@/lib/admin/comic-form";
import { adminForAction } from "@/lib/auth/require-admin";
import { CoverError, MAX_COVER_BYTES, processCover } from "@/lib/images/cover";
import { removeImages, uploadImage } from "@/lib/images/storage";
import { coverFiles, isStoredCover } from "@/lib/images/urls";

export type ComicFormState = {
  message?: string;
  fieldErrors?: Partial<Record<ComicField, string>>;
  values?: ComicFormValues;
  submission?: number; // changes on every failed submit so the form re-renders with `values`
};

const id = z.uuid();

function publishChange() {
  updateTag("catalog");
  refresh();
}

export async function saveComic(_prev: ComicFormState, formData: FormData): Promise<ComicFormState> {
  const comicId = formData.get("id");
  const editing = typeof comicId === "string" && comicId !== "";
  if (editing && !id.safeParse(comicId).success) return { message: "Unknown comic." };

  const admin = await adminForAction();
  if (!admin) return { message: "You don't have permission to do this." };
  const { supabase } = admin;
  const values = readComicForm(formData);
  const parsed = parseComicForm(values);
  const fail = (state: Omit<ComicFormState, "values" | "submission">): ComicFormState => ({
    ...state,
    values,
    submission: Date.now(),
  });
  if (!parsed.ok) return fail({ fieldErrors: parsed.fieldErrors, message: "Please fix the highlighted fields." });

  const d = parsed.data;
  const row = {
    title: d.title,
    slug: d.slug,
    alt_titles: d.altTitles,
    synopsis: d.synopsis,
    author: d.author || null,
    artist: d.artist || null,
    status: d.status,
    type: d.type,
    release_year: d.releaseYear,
    is_published: d.isPublished,
    is_featured: d.isFeatured,
    mangaupdates_id: d.mangaupdatesId,
    mangaupdates_url: d.mangaupdatesId ? d.mangaupdatesUrl : null,
  };

  // Genre ids must exist (a stale form could send a deleted genre).
  if (d.genreIds.length) {
    const { data: known } = await supabase.from("genres").select("id").in("id", d.genreIds);
    if ((known ?? []).length !== d.genreIds.length) {
      return fail({ fieldErrors: { genreIds: "One of the chosen genres no longer exists. Reload the page." } });
    }
  }

  const query = editing
    ? supabase.from("comics").update(row).eq("id", comicId).is("deleted_at", null).select("id")
    : supabase.from("comics").insert(row).select("id");
  const { data, error } = await query;

  if (error) {
    if (error.code === "23505" && error.message.includes("slug")) {
      return fail({ fieldErrors: { slug: "Another comic already uses this URL name." } });
    }
    if (error.code === "23505" && error.message.includes("mangaupdates_id")) {
      return fail({ message: "This MangaUpdates series is already linked to another comic." });
    }
    return fail({ message: "Could not save the comic. Please try again." });
  }
  const savedId = data?.[0]?.id;
  if (!savedId) return fail({ message: "This comic no longer exists (or is in the trash)." });

  const { error: genreError } = await supabase.rpc("set_comic_genres", {
    p_comic_id: savedId,
    p_genre_ids: d.genreIds,
  });
  if (genreError) return fail({ message: "The comic was saved, but its genres could not be updated. Try saving again." });

  updateTag("catalog");
  redirect(`/admin/comics/${savedId}?saved=1`);
}

// ---------------------------------------------------------------------------
// One-click actions from the comic list (used with .bind(null, ...)).
// ---------------------------------------------------------------------------

async function updateFlags(comicId: string, patch: { is_published?: boolean; is_featured?: boolean }) {
  if (!id.safeParse(comicId).success) return;
  const admin = await adminForAction();
  if (!admin) return;
  await admin.supabase.from("comics").update(patch).eq("id", comicId).is("deleted_at", null);
  publishChange();
}

export async function setPublished(comicId: string, value: boolean): Promise<void> {
  await updateFlags(comicId, { is_published: value === true });
}

export async function setFeatured(comicId: string, value: boolean): Promise<void> {
  await updateFlags(comicId, { is_featured: value === true });
}

export async function moveToTrash(comicId: string): Promise<void> {
  if (!id.safeParse(comicId).success) return;
  const admin = await adminForAction();
  if (!admin) return;
  await admin.supabase
    .from("comics")
    .update({ deleted_at: new Date().toISOString(), is_featured: false })
    .eq("id", comicId)
    .is("deleted_at", null);
  updateTag("catalog");
  redirect("/admin/trash?trashed=1");
}

export async function restoreFromTrash(comicId: string): Promise<void> {
  if (!id.safeParse(comicId).success) return;
  const admin = await adminForAction();
  if (!admin) return;
  await admin.supabase.from("comics").update({ deleted_at: null }).eq("id", comicId);
  publishChange();
}

export type DeleteState = { message?: string };

// Permanent. Owners only, only from the trash, and only after typing the title.
export async function deleteForever(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const comicId = formData.get("id");
  const typed = formData.get("confirmTitle");
  if (typeof comicId !== "string" || !id.safeParse(comicId).success) return { message: "Unknown comic." };

  const admin = await adminForAction();
  if (!admin) return { message: "You don't have permission to do this." };
  const { supabase } = admin;
  const { data: isOwner } = await supabase.rpc("is_owner");
  if (!isOwner) return { message: "Only the site owner can delete comics permanently." };

  const { data: comic } = await supabase
    .from("comics")
    .select("title, deleted_at, cover_key")
    .eq("id", comicId)
    .maybeSingle();
  if (!comic?.deleted_at) return { message: "Move the comic to the trash first." };
  if (typeof typed !== "string" || typed.trim() !== comic.title) {
    return { message: "The title you typed doesn't match. Nothing was deleted." };
  }

  const { data: deleted, error } = await supabase.from("comics").delete().eq("id", comicId).select("id");
  if (error || !deleted?.length) return { message: "Could not delete the comic. Please try again." };
  if (isStoredCover(comic.cover_key)) await removeImages(supabase, coverFiles(comic.cover_key));

  publishChange();
  return {};
}

// ---------------------------------------------------------------------------
// Cover images
// ---------------------------------------------------------------------------

export type CoverState = { ok?: boolean; message?: string; submission?: number };

// Upload or replace a cover. The file is checked and converted on the server
// (src/lib/images/cover.ts), stored as two WebP sizes, then the old files are
// removed. Used with useActionState and .bind(null, comicId).
export async function uploadCover(comicId: string, _prev: CoverState, formData: FormData): Promise<CoverState> {
  const result = (ok: boolean, message: string): CoverState => ({ ok, message, submission: Date.now() });
  if (!id.safeParse(comicId).success) return result(false, "Unknown comic.");
  const admin = await adminForAction();
  if (!admin) return result(false, "You don't have permission to do this.");
  const { supabase } = admin;

  const file = formData.get("cover");
  if (!(file instanceof File) || file.size === 0) return result(false, "Choose an image file first.");
  if (file.size > MAX_COVER_BYTES) return result(false, "The image is larger than 4 MB. Use a smaller file.");

  const { data: comic } = await supabase
    .from("comics")
    .select("cover_key")
    .eq("id", comicId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!comic) return result(false, "This comic no longer exists (or is in the trash).");

  let images;
  try {
    images = await processCover(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    return result(false, error instanceof CoverError ? error.message : "Could not read that image.");
  }

  const key = `covers/${comicId}/${randomUUID()}`;
  const [largePath, smallPath] = coverFiles(key);
  try {
    await uploadImage(supabase, largePath, images.large);
    await uploadImage(supabase, smallPath, images.small);
  } catch {
    await removeImages(supabase, [largePath, smallPath]);
    return result(false, "The upload to storage failed. Please try again.");
  }

  const { error } = await supabase.from("comics").update({ cover_key: key }).eq("id", comicId);
  if (error) {
    await removeImages(supabase, [largePath, smallPath]);
    return result(false, "Could not save the cover. Please try again.");
  }
  if (isStoredCover(comic.cover_key)) await removeImages(supabase, coverFiles(comic.cover_key));

  publishChange();
  return result(true, "Cover updated.");
}

export async function removeCover(comicId: string): Promise<void> {
  if (!id.safeParse(comicId).success) return;
  const admin = await adminForAction();
  if (!admin) return;
  const { data: comic } = await admin.supabase.from("comics").select("cover_key").eq("id", comicId).maybeSingle();
  if (!comic?.cover_key) return;
  const { error } = await admin.supabase.from("comics").update({ cover_key: null }).eq("id", comicId);
  if (!error && isStoredCover(comic.cover_key)) await removeImages(admin.supabase, coverFiles(comic.cover_key));
  publishChange();
}
