import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  type Texture
} from "three";

export const MAX_ARTWORK_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_ARTWORK_TEXTURE_SIZE = 2048;

export type DiscArtworkMode = "color" | "mask";

export type DiscArtworkTransform = {
  inverted: boolean;
  rotation: number;
  scale: number;
};

export type DiscArtworkSlot = {
  fileName: string;
  height: number;
  mode: DiscArtworkMode;
  previewUrl: string;
  texture: Texture;
  transform: DiscArtworkTransform;
  width: number;
};

export type DiscArtworkState = {
  back: DiscArtworkSlot | null;
  front: DiscArtworkSlot | null;
};

export const DEFAULT_ARTWORK_TRANSFORM: DiscArtworkTransform = {
  inverted: false,
  rotation: 0,
  scale: 1
};

const ACCEPTED_ARTWORK_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const ACCEPTED_ARTWORK_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp"
]);

export function validateArtworkFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const acceptedType =
    ACCEPTED_ARTWORK_TYPES.has(file.type) ||
    (!file.type && ACCEPTED_ARTWORK_EXTENSIONS.has(extension));

  if (!acceptedType) {
    return "Choose a PNG, JPEG, or WebP image.";
  }

  if (file.size > MAX_ARTWORK_FILE_SIZE) {
    return "Artwork must be 20 MB or smaller.";
  }

  return null;
}

export async function createArtworkSlot(
  file: File,
  maxAnisotropy: number
): Promise<DiscArtworkSlot> {
  const bitmap = await createImageBitmap(file);
  let previewUrl: string | null = null;
  let texture: CanvasTexture | null = null;

  try {
    if (bitmap.width < 1 || bitmap.height < 1) {
      throw new Error("Artwork has no readable image data.");
    }

    const canvasSize = Math.min(
      MAX_ARTWORK_TEXTURE_SIZE,
      Math.max(bitmap.width, bitmap.height)
    );
    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const context = canvas.getContext("2d", {
      alpha: true,
      colorSpace: "srgb"
    });

    if (!context) {
      throw new Error("Artwork could not be prepared.");
    }

    context.clearRect(0, 0, canvasSize, canvasSize);

    const containScale = Math.min(
      canvasSize / bitmap.width,
      canvasSize / bitmap.height
    );
    const drawWidth = bitmap.width * containScale;
    const drawHeight = bitmap.height * containScale;
    context.drawImage(
      bitmap,
      (canvasSize - drawWidth) / 2,
      (canvasSize - drawHeight) / 2,
      drawWidth,
      drawHeight
    );

    previewUrl = URL.createObjectURL(file);
    texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = Math.max(1, maxAnisotropy);
    texture.needsUpdate = true;

    return {
      fileName: file.name,
      height: bitmap.height,
      mode: "color",
      previewUrl,
      texture,
      transform: { ...DEFAULT_ARTWORK_TRANSFORM },
      width: bitmap.width
    };
  } catch (error) {
    texture?.dispose();

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    throw error;
  } finally {
    bitmap.close();
  }
}

export function disposeArtworkSlot(slot: DiscArtworkSlot | null) {
  if (!slot) {
    return;
  }

  slot.texture.dispose();
  URL.revokeObjectURL(slot.previewUrl);
}
