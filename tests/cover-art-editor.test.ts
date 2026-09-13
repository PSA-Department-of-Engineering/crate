import { describe, it, expect } from 'vitest';
import {
  calculateFitDimensions,
  MAX_EDITOR_DIMENSION,
  prepareImageForEditor,
} from '../src/utils/image-utils';
import { CoverArtEditorModal } from '../src/components/CoverArtEditorModal';

describe('Cover Art Editor & Large Image Optimization (#89)', () => {
  it('exports CoverArtEditorModal component', () => {
    expect(CoverArtEditorModal).toBeDefined();
    expect(typeof CoverArtEditorModal).toBe('function');
  });

  describe('calculateFitDimensions', () => {
    it('returns exact dimensions when image is already within max bounding box', () => {
      const result = calculateFitDimensions(800, 600, MAX_EDITOR_DIMENSION);
      expect(result).toEqual({ width: 800, height: 600 });
    });

    it('scales down landscape images exceeding MAX_EDITOR_DIMENSION while keeping aspect ratio', () => {
      // 4000x2000 -> fits within 1920x1920 -> width 1920, height 960
      const result = calculateFitDimensions(4000, 2000, 1920);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(960);
    });

    it('scales down portrait images exceeding MAX_EDITOR_DIMENSION while keeping aspect ratio', () => {
      // 3000x6000 -> fits within 1920x1920 -> height 1920, width 960
      const result = calculateFitDimensions(3000, 6000, 1920);
      expect(result.width).toBe(960);
      expect(result.height).toBe(1920);
    });

    it('scales down square high-res images exceeding MAX_EDITOR_DIMENSION', () => {
      // 4096x4096 -> 1920x1920
      const result = calculateFitDimensions(4096, 4096, 1920);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1920);
    });

    it('handles zero or negative dimensions safely', () => {
      expect(calculateFitDimensions(0, 0, 1920)).toEqual({ width: 1, height: 1 });
    });
  });

  describe('prepareImageForEditor', () => {
    it('preserves SVG files directly without rasterizing', async () => {
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>';
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });

      const result = await prepareImageForEditor(svgBlob);
      expect(result.format).toBe('image/svg+xml');
      expect(result.data).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('reads standard image files into data URIs', async () => {
      const dummyJpg = new Blob(['fake-jpg-content'], { type: 'image/jpeg' });
      const result = await prepareImageForEditor(dummyJpg);
      expect(result.format).toBe('image/jpeg');
      expect(result.data).toMatch(/^data:image\/jpeg;base64,/);
    });
  });
});
