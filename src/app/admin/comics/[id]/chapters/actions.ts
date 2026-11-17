"use server";

// Admin actions for chapters and their pages. Same rules as comic actions:
// admin check first, validated input, writes through the admin's session (RLS),
// public cache cleared afterwards. Chapter changes go into the audit log.

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseChapterForm, parseChapterNumber, type ChapterField } from "@/lib/admin/chapter-form";
import { adminForAction } from "@/lib/auth/require-admin";
import { removeImages } from "@/lib/images/storage";
import { imageUrl } from "@/lib/images/urls";
import { parseWebpSize } from "@/lib/images/webp";

const uuid = z.uuid();
const DENIED = "You don't have permission to do this.";
const MAX_PAGES_PER_CHAPTER = 400;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;

function publishChange() {
  updateTag("catalog");
  refresh();
}

async function chapterOf(supabase: NonNullable<Awaited<ReturnType<typeof adminForAction>>>["supabase"], chapterId: string) {
  const { data } = await supabase
    .from("chapters")
    .select("id, comic_id, number, status, published_at, deleted_at")
    .eq("id", chapterId)
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type NewChapterState = { error?: string; submission?: number };

export async function createChapter(comicId: string, _prev: NewChapterState, formData: FormData): Promise<NewChapterState> {
  const fail = (error: string): NewChapterState => ({ error, submission: Date.now() });
  if (!uuid.safeParse(comicId).success) return fail("Unknown comic.");
  const admin = await adminForAction();
  if (!admin) return fail(DENIED);

  const number = parseChapterNumber(String(formData.get("number") ?? ""));
  if (number === null) return fail("Enter a chapter number like 12 or 12.5.");
  const title = String(formData.get("title") ?? "").trim();
  if (title.length > 200) return fail("Title: 200 characters at most.");

  const { data, error } = await admin.supabase
    .from("chapters")
    .insert({ comic_id: comicId, number, title: title || null, status: "draft" })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const { data: removed } = await admin.supabase
      .from("chapters")
      .select("id")
      .eq("comic_id", comicId)
      .eq("number", number)
      .not("deleted_at", "is", null)
      .maybeSingle();
    return fail(
      removed
        ? `Chapter ${number} exists in "Removed chapters" below. Restore it, or delete it permanently first.`
        : `Chapter ${number} already exists.`,
    );
  }
  if (error || !data) return fail("Could not create the chapter. Please try again.");

  redirect(`/admin/comics/${comicId}/chapters/${data.id}?created=1`);
}

// ---------------------------------------------------------------------------
// Details + publishing
// ---------------------------------------------------------------------------

export type ChapterFormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Partial<Record<ChapterField, string>>;
  submission?: number;
};

export async function saveChapter(chapterId: string, _prev: ChapterFormState, formData: FormData): Promise<ChapterFormState> {
  const done = (state: ChapterFormState): ChapterFormState => ({ ...state, submission: Date.now() });
  if (!uuid.safeParse(chapterId).success) return done({ message: "Unknown chapter." });
  const admin = await adminForAction();
  if (!admin) return done({ message: DENIED });
  const { supabase } = admin;

  const parsed = parseChapterForm(formData);
  if (!parsed.ok) return done({ fieldErrors: parsed.fieldErrors, message: "Please fix the highlighted fields." });
  const d = parsed.data;

  const current = await chapterOf(supabase, chapterId);
  if (!current || current.deleted_at) return done({ message: "This chapter no longer exists (or was removed)." });

  if (d.visibility !== "draft") {
    const { count } = await supabase.from("chapter_images").select("id", { count: "exact", head: true }).eq("chapter_id", chapterId);
    if (!count) return done({ message: "Upload at least one page before publishing." });
  }

  const now = new Date();
  const alreadyReleased =
    current.status === "published" && current.published_at !== null && new Date(current.published_at) <= now;
  const publishedAt =
    d.visibility === "draft"
      ? null
      : d.visibility === "schedule"
        ? d.publishAt
        : alreadyReleased
          ? current.published_at // keep the original release date when editing
          : now.toISOString();

  const { error } = await supabase
    .from("chapters")
    .update({
      number: d.number,
      title: d.title,
      status: d.visibility === "draft" ? "draft" : "published",
      published_at: publishedAt,
    })
    .eq("id", chapterId);
  if (error?.code === "23505") return done({ fieldErrors: { number: `Chapter ${d.number} already exists for this comic.` } });
  if (error) return done({ message: "Could not save the chapter. Please try again." });

  publishChange();
  return done({
    ok: true,
    message:
      d.visibility === "draft"
        ? "Saved as a draft. Only admins can see it."
        : d.visibility === "schedule" && publishedAt && new Date(publishedAt) > now
          ? "Scheduled. It goes live automatically at the chosen time (within about a minute)."
          : "Published. Readers can see it now.",
  });
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export type AddPagesResult = { added: number; rejected: { path: string; reason: string }[]; error?: string };

// Called by the uploader after the browser has put the files in storage.
// Every file is checked here (location, real WebP, size) before it becomes a page.
export async function addChapterPages(chapterId: string, files: { path: string }[]): Promise<AddPagesResult> {
  if (!uuid.safeParse(chapterId).success) return { added: 0, rejected: [], error: "Unknown chapter." };
  const admin = await adminForAction();
  if (!admin) return { added: 0, rejected: [], error: DENIED };
  const { supabase } = admin;
  if (!Array.isArray(files) || files.length === 0 || files.length > 200) {
    return { added: 0, rejected: [], error: "Send between 1 and 200 pages at a time." };
  }

  const current = await chapterOf(supabase, chapterId);
  if (!current || current.deleted_at) return { added: 0, rejected: [], error: "This chapter no longer exists." };
  const { count } = await supabase.from("chapter_images").select("id", { count: "exact", head: true }).eq("chapter_id", chapterId);
  if ((count ?? 0) + files.length > MAX_PAGES_PER_CHAPTER) {
    return { added: 0, rejected: [], error: `A chapter can have at most ${MAX_PAGES_PER_CHAPTER} pages.` };
  }

  const pattern = new RegExp(`^chapters/${chapterId}/[0-9a-f-]{36}\\.webp$`);
  const checked = await Promise.all(
    files.map(async ({ path }) => {
      if (typeof path !== "string" || !pattern.test(path)) return { path: String(path), reason: "Wrong location." };
      try {
        // Read just the start of the file: enough for the WebP header.
        const res = await fetch(imageUrl(path), { headers: { Range: "bytes=0-63" }, cache: "no-store" });
        if (!res.ok) return { path, reason: "The file isn't in storage." };
        const total = Number(res.headers.get("content-range")?.split("/")[1] ?? res.headers.get("content-length") ?? 0);
        const size = parseWebpSize(new Uint8Array(await res.arrayBuffer()));
        if (!size) return { path, reason: "Not a valid WebP image." };
        if (!total || total > MAX_PAGE_BYTES) return { path, reason: "Too large." };
        if (size.width > 4000 || size.height > 16000) return { path, reason: "Image dimensions are too large." };
        return { path, page: { storage_key: path, width: size.width, height: size.height, bytes: total } };
      } catch {
        return { path, reason: "Couldn't check the file." };
      }
    }),
  );

  const good = checked.flatMap((c) => ("page" in c && c.page ? [c.page] : []));
  const rejected = checked.flatMap((c) => ("reason" in c && c.reason ? [{ path: c.path, reason: c.reason }] : []));
  if (rejected.length) await removeImages(supabase, rejected.map((r) => r.path).filter((p) => pattern.test(p)));

  if (good.length) {
    const { error } = await supabase.rpc("append_chapter_images", { p_chapter_id: chapterId, p_pages: good });
    if (error) {
      await removeImages(supabase, good.map((g) => g.storage_key));
      return { added: 0, rejected, error: "Could not save the pages. Please upload them again." };
    }
  }
  publishChange();
  return { added: good.length, rejected };
}

export async function reorderPages(chapterId: string, imageIds: string[]): Promise<{ error?: string }> {
  if (!uuid.safeParse(chapterId).success || !Array.isArray(imageIds) || !imageIds.every((i) => uuid.safeParse(i).success)) {
    return { error: "Invalid page list." };
  }
  const admin = await adminForAction();
  if (!admin) return { error: DENIED };
  const { error } = await admin.supabase.rpc("reorder_chapter_images", { p_chapter_id: chapterId, p_image_ids: imageIds });
  if (error) return { error: error.message.includes("out of date") ? error.message : "Could not save the new order." };
  publishChange();
  return {};
}

export async function deletePage(chapterId: string, imageId: string): Promise<{ error?: string }> {
  if (!uuid.safeParse(chapterId).success || !uuid.safeParse(imageId).success) return { error: "Invalid page." };
  const admin = await adminForAction();
  if (!admin) return { error: DENIED };
  const { supabase } = admin;

  const { data: removed, error } = await supabase
    .from("chapter_images")
    .delete()
    .eq("id", imageId)
    .eq("chapter_id", chapterId)
    .select("storage_key");
  if (error || !removed?.length) return { error: "Could not delete the page." };
  await removeImages(supabase, removed.map((r) => r.storage_key));

  // Close the gap so positions stay 0, 1, 2, ...
  const { data: rest } = await supabase.from("chapter_images").select("id").eq("chapter_id", chapterId).order("position");
  if (rest?.length) await supabase.rpc("reorder_chapter_images", { p_chapter_id: chapterId, p_image_ids: rest.map((r) => r.id) });

  publishChange();
  return {};
}

// ---------------------------------------------------------------------------
// Remove / restore / delete forever
// ---------------------------------------------------------------------------

export async function removeChapter(chapterId: string): Promise<void> {
  if (!uuid.safeParse(chapterId).success) return;
  const admin = await adminForAction();
  if (!admin) return;
  const current = await chapterOf(admin.supabase, chapterId);
  if (!current) return;
  await admin.supabase.from("chapters").update({ deleted_at: new Date().toISOString() }).eq("id", chapterId);
  updateTag("catalog");
  redirect(`/admin/comics/${current.comic_id}/chapters?removed=1`);
}

export async function restoreChapter(chapterId: string): Promise<void> {
  if (!uuid.safeParse(chapterId).success) return;
  const admin = await adminForAction();
  if (!admin) return;
  await admin.supabase.from("chapters").update({ deleted_at: null }).eq("id", chapterId);
  publishChange();
}

export async function deleteChapterForever(chapterId: string): Promise<{ error?: string }> {
  if (!uuid.safeParse(chapterId).success) return { error: "Unknown chapter." };
  const admin = await adminForAction();
  if (!admin) return { error: DENIED };
  const { supabase } = admin;
  const { data: isOwner } = await supabase.rpc("is_owner");
  if (!isOwner) return { error: "Only the site owner can delete chapters permanently." };

  const current = await chapterOf(supabase, chapterId);
  if (!current?.deleted_at) return { error: "Remove the chapter first." };
  const { data: pages } = await supabase.from("chapter_images").select("storage_key").eq("chapter_id", chapterId);

  const { data: deleted, error } = await supabase.from("chapters").delete().eq("id", chapterId).select("id");
  if (error || !deleted?.length) return { error: "Could not delete the chapter." };
  await removeImages(supabase, (pages ?? []).map((p) => p.storage_key));

  publishChange();
  return {};
}
