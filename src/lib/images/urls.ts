// Public addresses of stored images. Safe to use anywhere (server or browser).
//
// Today images live in Supabase Storage. To move to Cloudflare R2 (or any
// other host) later, copy the files and set NEXT_PUBLIC_IMAGE_BASE_URL to the
// new address: every image link on the site follows this one setting.

const BASE = (
  process.env.NEXT_PUBLIC_IMAGE_BASE_URL ||
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/images`
).replace(/\/$/, "");

export type CoverUrls = { small: string; large: string };

// A comic's cover_key -> its two sizes.
//   "covers/<comic id>/<random>"         a cover uploaded on Isfrid (Supabase Storage)
//   "md:<mangadex id>/<file name>"       a MangaDex cover, served through our own
//                                        /api/mangadex/cover route (MangaDex refuses
//                                        hotlinked images), in their 256/512 px thumbnails
export function coverUrls(coverKey: string | null | undefined): CoverUrls | null {
  if (!coverKey) return null;
  if (coverKey.startsWith("md:")) {
    const path = `/api/mangadex/cover/${coverKey.slice(3)}`;
    return { small: `${path}.256.jpg`, large: `${path}.512.jpg` };
  }
  return { small: `${BASE}/${coverKey}-300.webp`, large: `${BASE}/${coverKey}-600.webp` };
}

// Covers stored in our own storage (MangaDex covers aren't ours to delete).
export function isStoredCover(coverKey: string | null | undefined): coverKey is string {
  return Boolean(coverKey) && !coverKey!.startsWith("md:");
}

// Address of any stored file, e.g. a chapter page ("chapters/<id>/<uuid>.webp").
export function imageUrl(path: string): string {
  return `${BASE}/${path}`;
}

// The two stored files behind a cover_key.
export function coverFiles(coverKey: string): string[] {
  return [`${coverKey}-600.webp`, `${coverKey}-300.webp`];
}
