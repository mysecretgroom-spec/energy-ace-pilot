/**
 * Read EXIF orientation from an ArrayBuffer (JPEG).
 * Returns orientation 1-8, or 1 if not found.
 */
export function readExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (view.byteLength < 4) return 1;

  // Check JPEG SOI
  if (view.getUint16(0) !== 0xffd8) return 1;

  let offset = 2;
  while (offset < view.byteLength - 2) {
    const marker = view.getUint16(offset);
    if (marker === 0xffe1) {
      // APP1 (EXIF)
      const length = view.getUint16(offset + 2);
      return parseExifBlock(view, offset + 4, length - 2);
    }
    // Skip other markers
    if ((marker & 0xff00) !== 0xff00) break;
    const segLen = view.getUint16(offset + 2);
    offset += 2 + segLen;
  }

  return 1;
}

function parseExifBlock(view: DataView, start: number, _length: number): number {
  // Check "Exif\0\0"
  if (start + 6 > view.byteLength) return 1;
  const exifHeader = String.fromCharCode(
    view.getUint8(start), view.getUint8(start + 1),
    view.getUint8(start + 2), view.getUint8(start + 3)
  );
  if (exifHeader !== "Exif") return 1;

  const tiffStart = start + 6;
  if (tiffStart + 8 > view.byteLength) return 1;

  const byteOrder = view.getUint16(tiffStart);
  const littleEndian = byteOrder === 0x4949;

  const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
  const ifdStart = tiffStart + ifdOffset;

  if (ifdStart + 2 > view.byteLength) return 1;
  const entries = view.getUint16(ifdStart, littleEndian);

  for (let i = 0; i < entries; i++) {
    const entryOffset = ifdStart + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, littleEndian);
    if (tag === 0x0112) {
      return view.getUint16(entryOffset + 8, littleEndian);
    }
  }

  return 1;
}

/**
 * Normalize image orientation using canvas.
 * Returns a canvas with the image drawn upright.
 * Also downscales if > maxPixels (default 12MP for iOS safety).
 */
export async function normalizeOrientation(
  blob: Blob,
  maxPixels = 12_000_000
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const buffer = await blob.arrayBuffer();
  const orientation = readExifOrientation(buffer);

  const img = await createImageBitmap(blob);
  let { width, height } = img;

  // Downscale if too large
  const pixels = width * height;
  if (pixels > maxPixels) {
    const scale = Math.sqrt(maxPixels / pixels);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // Handle orientation transforms
  const swapDims = orientation >= 5 && orientation <= 8;
  canvas.width = swapDims ? height : width;
  canvas.height = swapDims ? width : height;

  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, width, height); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, height); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, height, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, height, width); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, width); break;
    default: break;
  }

  ctx.drawImage(img, 0, 0, width, height);
  img.close?.();

  return { canvas, width: canvas.width, height: canvas.height };
}
