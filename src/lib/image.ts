// Client-side image compressor for invoice branding (logo and signature).
// Resizes oversized images on an off-screen canvas to fit invoice headers,
// keeping files under ~120 KB without requiring manual editing or external tools.

export interface CompressedImage {
  dataUrl: string;
  originalKb: number;
  compressedKb: number;
  width: number;
  height: number;
}

export function compressImage(
  file: File,
  maxWidth = 400,
  maxHeight = 160
): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            dataUrl: String(reader.result),
            originalKb: Math.round(file.size / 1024),
            compressedKb: Math.round(file.size / 1024),
            width: img.width,
            height: img.height,
          });
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer PNG to preserve transparency for logos; if still large, fall back to WebP (keeps alpha, unlike JPEG)
        let dataUrl = canvas.toDataURL('image/png');
        let bytes = Math.round((dataUrl.length * 3) / 4);
        if (bytes > 120 * 1024) {
          dataUrl = canvas.toDataURL('image/webp', 0.85);
          bytes = Math.round((dataUrl.length * 3) / 4);
        }

        resolve({
          dataUrl,
          originalKb: Math.round(file.size / 1024),
          compressedKb: Math.round(bytes / 1024),
          width,
          height,
        });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
