export type CompressedImageResult = {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  wasCompressed: boolean;
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Resizes and compresses an uploaded image in the browser using <canvas>.
 * Outputs JPEG (universally supported by WhatsApp Open Graph crawlers) capped
 * at 1200px on the longest side so buyers on slow Ghanaian mobile data load fast.
 */
export async function compressListingImage(
  file: File,
  options?: { maxDimension?: number; quality?: number }
): Promise<CompressedImageResult> {
  const maxDimension = options?.maxDimension ?? 1200;
  const quality = options?.quality ?? 0.8;
  const originalBytes = file.size;

  try {
    const img = await loadImage(file);
    const { width, height } = img;

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        file,
        originalBytes,
        compressedBytes: originalBytes,
        wasCompressed: false,
      };
    }

    // Fill white background in case the source PNG has transparency
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );

    if (!blob || blob.size >= originalBytes) {
      return {
        file,
        originalBytes,
        compressedBytes: originalBytes,
        wasCompressed: false,
      };
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "listing-photo";
    const compressedFile = new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    return {
      file: compressedFile,
      originalBytes,
      compressedBytes: compressedFile.size,
      wasCompressed: true,
    };
  } catch {
    return {
      file,
      originalBytes,
      compressedBytes: originalBytes,
      wasCompressed: false,
    };
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}
