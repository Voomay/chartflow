export interface CompressedScreenshotResult {
  dataUrl: string;
  byteSize: number;
  mimeType: string;
  width: number;
  height: number;
}

export interface CompressCanvasOptions {
  /** Maximum output width in CSS pixels (height scales proportionally). Default: 1080 */
  maxWidth?: number;
  /** Maximum target size in bytes (e.g., 70 * 1024 = 70 KB). Default: 70 KB */
  maxBytes?: number;
  /** Preferred quality steps to try before downscaling further. */
  qualitySteps?: number[];
  /** Background color used when flattening transparent regions for JPEG fallback. */
  backgroundColor?: string;
}

const DEFAULT_MAX_WIDTH = 1080;
const DEFAULT_MAX_BYTES = 70 * 1024; // 70 KB
const DEFAULT_QUALITY_STEPS = [0.78, 0.66, 0.54, 0.44, 0.34];

/**
 * Estimates the decoded byte length of a base64 data URL (or raw UTF-8 string for non-base64).
 */
export function estimateDataUrlBytes(dataUrl: string): number {
  if (!dataUrl) return 0;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const header = dataUrl.slice(0, commaIdx);
  const payload = dataUrl.slice(commaIdx + 1);
  if (header.includes(';base64')) {
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  }
  return payload.length;
}

/**
 * Formats byte size as a compact human-readable KB string (e.g. "38 KB").
 */
export function formatScreenshotSizeKb(dataUrl: string): string {
  const bytes = estimateDataUrlBytes(dataUrl);
  if (bytes <= 0) return '0 KB';
  const kb = Math.max(1, Math.round(bytes / 1024));
  return `${kb} KB`;
}

function renderScaledCanvas(
  source: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
  backgroundColor?: string
): HTMLCanvasElement {
  const scaled = document.createElement('canvas');
  scaled.width = Math.max(1, Math.round(targetWidth));
  scaled.height = Math.max(1, Math.round(targetHeight));
  const ctx = scaled.getContext('2d');
  if (!ctx) return source;
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, scaled.width, scaled.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, scaled.width, scaled.height);
  return scaled;
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  mimeType: 'image/webp' | 'image/jpeg',
  quality: number
): string | null {
  try {
    const url = canvas.toDataURL(mimeType, quality);
    if (!url || !url.startsWith('data:')) return null;
    // Browsers that don't support WebP encoding silently fall back to image/png.
    if (mimeType === 'image/webp' && !url.startsWith('data:image/webp')) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Compresses an HTMLCanvasElement into a lightweight KB-sized WebP (or JPEG fallback) data URL
 * suitable for storing inside trade journals and syncing to Supabase JSONB.
 */
export function compressCanvasToKbDataUrl(
  source: HTMLCanvasElement,
  options: CompressCanvasOptions = {}
): CompressedScreenshotResult | null {
  if (!source || source.width <= 0 || source.height <= 0) return null;

  const maxWidth = Math.max(320, options.maxWidth ?? DEFAULT_MAX_WIDTH);
  const maxBytes = Math.max(12 * 1024, options.maxBytes ?? DEFAULT_MAX_BYTES);
  const qualitySteps =
    options.qualitySteps && options.qualitySteps.length > 0
      ? options.qualitySteps
      : DEFAULT_QUALITY_STEPS;
  const backgroundColor = options.backgroundColor;

  const aspect = source.height / source.width;
  const widthScales = [1, 0.8, 0.65];

  let bestResult: CompressedScreenshotResult | null = null;

  for (const scale of widthScales) {
    const targetWidth = Math.min(source.width, Math.round(maxWidth * scale));
    const targetHeight = Math.max(1, Math.round(targetWidth * aspect));
    const workingCanvas =
      targetWidth === source.width && targetHeight === source.height
        ? source
        : renderScaledCanvas(source, targetWidth, targetHeight, backgroundColor);

    // Prefer WebP first (sharper chart lines & text at smaller KB), then JPEG fallback.
    const formats: Array<'image/webp' | 'image/jpeg'> = ['image/webp', 'image/jpeg'];
    let supportedFormat: 'image/webp' | 'image/jpeg' | null = null;

    for (const fmt of formats) {
      const probe = encodeCanvas(workingCanvas, fmt, qualitySteps[0]);
      if (probe) {
        supportedFormat = fmt;
        const byteSize = estimateDataUrlBytes(probe);
        const candidate: CompressedScreenshotResult = {
          dataUrl: probe,
          byteSize,
          mimeType: fmt,
          width: workingCanvas.width,
          height: workingCanvas.height,
        };
        if (!bestResult || candidate.byteSize < bestResult.byteSize) {
          bestResult = candidate;
        }
        if (byteSize <= maxBytes) {
          return candidate;
        }
        break;
      }
    }

    if (!supportedFormat) continue;

    for (let i = 1; i < qualitySteps.length; i++) {
      const encoded = encodeCanvas(workingCanvas, supportedFormat, qualitySteps[i]);
      if (!encoded) continue;
      const byteSize = estimateDataUrlBytes(encoded);
      const candidate: CompressedScreenshotResult = {
        dataUrl: encoded,
        byteSize,
        mimeType: supportedFormat,
        width: workingCanvas.width,
        height: workingCanvas.height,
      };
      if (!bestResult || candidate.byteSize < bestResult.byteSize) {
        bestResult = candidate;
      }
      if (byteSize <= maxBytes) {
        return candidate;
      }
    }
  }

  return bestResult;
}
