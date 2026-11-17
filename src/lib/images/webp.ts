// Reads a WebP file's width and height from its first 30 bytes, so the server
// can check uploaded pages itself instead of trusting the browser. Returns
// null for anything that isn't a valid WebP header. Pure; tested in webp.test.ts.

export function parseWebpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(0, 4) !== "RIFF" || ascii(8, 12) !== "WEBP") return null;

  const chunk = ascii(12, 16);
  const u16 = (i: number) => bytes[i] | (bytes[i + 1] << 8);
  const u24 = (i: number) => bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16);

  if (chunk === "VP8X") {
    // Extended format: 24-bit (width-1) and (height-1).
    return { width: u24(24) + 1, height: u24(27) + 1 };
  }
  if (chunk === "VP8 ") {
    // Lossy: frame tag 9D 01 2A, then 14-bit width and height.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return { width: u16(26) & 0x3fff, height: u16(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    // Lossless: signature 0x2F, then 14-bit (width-1) and (height-1) packed.
    if (bytes[20] !== 0x2f) return null;
    const b = (i: number) => bytes[21 + i];
    const width = 1 + (((b(1) & 0x3f) << 8) | b(0));
    const height = 1 + (((b(3) & 0x0f) << 10) | (b(2) << 2) | ((b(1) & 0xc0) >> 6));
    return { width, height };
  }
  return null;
}
