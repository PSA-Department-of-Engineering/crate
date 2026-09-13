export const MAX_EDITOR_DIMENSION = 1920;
export const MAX_EDITOR_SOURCE_BYTES = 10 * 1024 * 1024;

export interface ScaledImageResult {
  data: string;
  format: string;
}

/**
 * Calculates bounding dimensions preserving aspect ratio.
 */
export function calculateFitDimensions(
  width: number,
  height: number,
  maxDimension: number = MAX_EDITOR_DIMENSION
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height) };
  }
  if (width <= maxDimension && height <= maxDimension) {
    return { width: Math.round(width), height: Math.round(height) };
  }

  const scale = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Reads a File or Blob as a base64 Data URI.
 */
export async function readFileAsDataUri(file: File | Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Could not read the selected image.'));
        }
      };
      reader.onerror = () => reject(new Error('Could not read the selected image.'));
      reader.readAsDataURL(file);
    });
  }

  // Node.js / Vitest test environment fallback
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = file.type || 'image/jpeg';
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Decodes an image from a Data URI into an HTMLImageElement.
 */
export function loadImageElement(dataUri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This file could not be decoded as an image.'));
    img.src = dataUri;
  });
}

/**
 * Scales an image element onto an in-memory canvas and encodes it as JPEG.
 */
export function scaleImageElementToJpeg(
  image: CanvasImageSource,
  targetWidth: number,
  targetHeight: number,
  quality: number = 0.88
): string {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Processes a chosen image File (or Blob), automatically downscaling large photos
 * to workable editor dimensions and memory sizes.
 */
export async function prepareImageForEditor(
  file: File | Blob,
  maxDimension: number = MAX_EDITOR_DIMENSION,
  maxBytes: number = MAX_EDITOR_SOURCE_BYTES
): Promise<ScaledImageResult> {
  if (file.type === 'image/svg+xml') {
    const dataUri = await readFileAsDataUri(file);
    return { data: dataUri, format: 'image/svg+xml' };
  }

  const rawDataUri = await readFileAsDataUri(file);

  if (typeof createImageBitmap !== 'undefined') {
    try {
      const bitmap = await createImageBitmap(file);
      const { width: origWidth, height: origHeight } = bitmap;

      const needsDownscale =
        origWidth > maxDimension ||
        origHeight > maxDimension ||
        file.size > maxBytes;

      if (!needsDownscale && file.size <= maxBytes) {
        bitmap.close?.();
        return { data: rawDataUri, format: file.type || 'image/jpeg' };
      }

      const { width, height } = calculateFitDimensions(origWidth, origHeight, maxDimension);
      const scaledDataUri = scaleImageElementToJpeg(bitmap, width, height, 0.88);
      bitmap.close?.();
      return { data: scaledDataUri, format: 'image/jpeg' };
    } catch {
      // Fallback to Image loading below if createImageBitmap fails
    }
  }

  if (typeof Image !== 'undefined') {
    try {
      const img = await loadImageElement(rawDataUri);
      const needsDownscale =
        img.naturalWidth > maxDimension ||
        img.naturalHeight > maxDimension ||
        file.size > maxBytes;

      if (!needsDownscale && file.size <= maxBytes) {
        return { data: rawDataUri, format: file.type || 'image/jpeg' };
      }

      const { width, height } = calculateFitDimensions(img.naturalWidth, img.naturalHeight, maxDimension);
      const scaledDataUri = scaleImageElementToJpeg(img, width, height, 0.88);
      return { data: scaledDataUri, format: 'image/jpeg' };
    } catch (error) {
      if (file.size <= maxBytes) {
        return { data: rawDataUri, format: file.type || 'image/jpeg' };
      }
      throw error;
    }
  }

  return { data: rawDataUri, format: file.type || 'image/jpeg' };
}
