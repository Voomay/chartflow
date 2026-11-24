import { describe, expect, it, vi } from 'vitest';
import {
  compressCanvasToKbDataUrl,
  estimateDataUrlBytes,
  formatScreenshotSizeKb,
} from '../chartScreenshot';

function makeBase64DataUrl(mime: string, byteCount: number): string {
  const base64Len = Math.ceil(byteCount / 3) * 4;
  return `data:${mime};base64,${'A'.repeat(base64Len)}`;
}

describe('chartScreenshot compression helpers', () => {
  it('estimates base64 data URL byte size accurately', () => {
    const url = makeBase64DataUrl('image/webp', 36 * 1024);
    const bytes = estimateDataUrlBytes(url);
    expect(bytes).toBeGreaterThanOrEqual(36 * 1024);
    expect(bytes).toBeLessThanOrEqual(36 * 1024 + 4);
    expect(formatScreenshotSizeKb(url)).toBe('36 KB');
  });

  it('steps down quality until screenshot fits within KB budget', () => {
    const fakeCanvas = {
      width: 960,
      height: 540,
      toDataURL: vi.fn((mime: string, quality?: number) => {
        if (mime === 'image/webp') {
          const q = quality ?? 0.8;
          // Simulate larger output at high quality and ~42KB at <= 0.54
          const size = q > 0.6 ? 110 * 1024 : 42 * 1024;
          return makeBase64DataUrl('image/webp', size);
        }
        return makeBase64DataUrl('image/jpeg', 95 * 1024);
      }),
    } as unknown as HTMLCanvasElement;

    const result = compressCanvasToKbDataUrl(fakeCanvas, {
      maxWidth: 1080,
      maxBytes: 65 * 1024,
    });

    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe('image/webp');
    expect(result!.byteSize).toBeLessThanOrEqual(65 * 1024);
    expect(result!.dataUrl.startsWith('data:image/webp;base64,')).toBe(true);
  });

  it('falls back to JPEG when browser returns PNG for image/webp', () => {
    const fakeCanvas = {
      width: 900,
      height: 500,
      toDataURL: vi.fn((mime: string) => {
        if (mime === 'image/webp') {
          // Simulate browser without WebP encode support falling back to PNG
          return makeBase64DataUrl('image/png', 240 * 1024);
        }
        return makeBase64DataUrl('image/jpeg', 48 * 1024);
      }),
    } as unknown as HTMLCanvasElement;

    const result = compressCanvasToKbDataUrl(fakeCanvas, {
      maxWidth: 1080,
      maxBytes: 70 * 1024,
    });

    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe('image/jpeg');
    expect(result!.byteSize).toBeLessThanOrEqual(70 * 1024);
  });
});
