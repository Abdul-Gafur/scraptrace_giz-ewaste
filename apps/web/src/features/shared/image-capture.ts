/**
 * Image validation and reduction (FR-VIS-002).
 *
 * An accepted image is checked by type and size first, then reduced to a bounded JPEG so a phone
 * photograph does not exhaust the device store while keeping enough detail for classification.
 * Reduction uses a canvas; where that is unavailable the original blob is used unchanged and the
 * caller is told the image was not reduced, so nothing silently claims a smaller file was stored.
 */

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
/** Longest edge of the reduced image. 1024px keeps item detail at a small file size. */
const MAX_EDGE_PIXELS = 1024;
/** Longest edge of the preview kept for redisplay in the device store. */
const PREVIEW_EDGE_PIXELS = 320;
const JPEG_QUALITY = 0.75;

export type ImageRejection =
  | { readonly ok: false; readonly reason: "unsupported_type" }
  | { readonly ok: false; readonly reason: "too_large" };

export interface AcceptedImage {
  readonly ok: true;
  readonly blob: Blob;
  /** Small data URL kept so the photograph can be shown again after a refresh. */
  readonly preview: string | null;
  readonly reduced: boolean;
  readonly originalBytes: number;
}

export type ImageResult = AcceptedImage | ImageRejection;

const loadImage = (blob: Blob): Promise<HTMLImageElement> => {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_decode_failed"));
    };
    image.src = url;
  });
};

const drawScaled = (image: HTMLImageElement, maxEdge: number): HTMLCanvasElement | null => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", JPEG_QUALITY);
  });

export const prepareImage = async (file: File): Promise<ImageResult> => {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: "unsupported_type" };
  }
  if (file.size > MAX_SOURCE_BYTES) return { ok: false, reason: "too_large" };

  try {
    const image = await loadImage(file);
    const fullCanvas = drawScaled(image, MAX_EDGE_PIXELS);
    const previewCanvas = drawScaled(image, PREVIEW_EDGE_PIXELS);
    const reducedBlob = fullCanvas ? await toBlob(fullCanvas) : null;
    return {
      ok: true,
      blob: reducedBlob ?? file,
      preview: previewCanvas?.toDataURL("image/jpeg", 0.6) ?? null,
      reduced: reducedBlob !== null,
      originalBytes: file.size,
    };
  } catch {
    // The file passed validation but could not be decoded for reduction; it is used as supplied.
    return { ok: true, blob: file, preview: null, reduced: false, originalBytes: file.size };
  }
};
