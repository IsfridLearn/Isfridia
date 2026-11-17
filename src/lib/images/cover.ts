// Turns an uploaded cover image into the two WebP files the site serves.
// Used only on the server (by the upload action). Unit-tested in cover.test.ts.
//
// - accepts JPG, PNG, WebP or AVIF, up to 4 MB, at least 300 x 300 px
// - crops to the 2:3 cover shape, centred on the most interesting area
// - outputs 600 x 900 ("large") and 300 x 450 ("small") WebP files
// - drops hidden metadata (camera, location) automatically

import sharp from "sharp";

export const MAX_COVER_BYTES = 4 * 1024 * 1024;
const ACCEPTED = new Set(["jpeg", "png", "webp", "avif", "heif"]);

export class CoverError extends Error {}

export async function processCover(input: Buffer): Promise<{ large: Buffer; small: Buffer }> {
  if (input.length === 0) throw new CoverError("Choose an image file.");
  if (input.length > MAX_COVER_BYTES) throw new CoverError("The image is larger than 4 MB. Use a smaller file.");

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new CoverError("That file isn't an image we can read. Use JPG, PNG, WebP or AVIF.");
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) {
    throw new CoverError("Use a JPG, PNG, WebP or AVIF image.");
  }
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const height = meta.autoOrient?.height ?? meta.height ?? 0;
  if (width < 300 || height < 300) {
    throw new CoverError(`The image is only ${width} x ${height} px. Use at least 300 x 300 (600 x 900 looks best).`);
  }
  if (width > 12000 || height > 12000) throw new CoverError("The image is too large (over 12000 px on a side).");

  const crop = (w: number, h: number) =>
    sharp(input)
      .rotate() // respect phone-camera orientation
      .resize(w, h, { fit: "cover", position: sharp.strategy.attention })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();

  const [large, small] = await Promise.all([crop(600, 900), crop(300, 450)]);
  return { large, small };
}
