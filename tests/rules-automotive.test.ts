import { describe, it, expect } from 'vitest';
import {
  MaxPathLengthRule,
  AutoEmbedFolderArtworkRule,
  ArtworkDimensionRule,
  CompanionJunkCleanupRule,
  isJunkCompanionFile,
} from '../src/services/rules';
import { Track } from '../src/models/types';

describe('Automotive & Car Compatibility Rules (#57, #60, #61, #62)', () => {
  const baseTrack: Track = {
    id: 'test-track-1',
    filePath: 'C:/Music/Artist/Album/01 Track.mp3',
    title: 'Track',
    artist: 'Artist',
    album: 'Album',
    trackNumber: 1,
    duration: 180,
    format: 'mp3',
    fileSize: 5000000,
    mtime: Date.now(),
  };

  describe('#57 MaxPathLengthRule', () => {
    it('ignores paths that are within the 260 character limit', () => {
      expect(MaxPathLengthRule.evaluate(baseTrack)).toBeNull();
    });

    it('flags paths exceeding 260 characters and shortens title while preserving track prefix and extension', () => {
      const longTitle = 'A'.repeat(250);
      const longPathTrack: Track = {
        ...baseTrack,
        filePath: `C:/Music/Very Long Artist Name/Very Long Album Name/01 ${longTitle}.mp3`,
      };

      expect(longPathTrack.filePath.length).toBeGreaterThan(260);

      const v = MaxPathLengthRule.evaluate(longPathTrack);
      expect(v).not.toBeNull();
      expect(v?.ruleId).toBe('rule-max-path-length');
      expect(v?.proposedRenamePath).toBeDefined();
      expect(v?.proposedRenamePath!.length).toBeLessThanOrEqual(260);
      expect(v?.proposedRenamePath).toContain('01 ');
      expect(v?.proposedRenamePath).toMatch(/\.mp3$/);
    });
  });

  describe('#60 Extended CompanionJunkCleanupRule', () => {
    it('identifies desktop.ini and macOS AppleDouble ._* shadow files for deletion', () => {
      expect(isJunkCompanionFile('desktop.ini')).toBe(true);
      expect(isJunkCompanionFile('DESKTOP.INI')).toBe(true);
      expect(isJunkCompanionFile('._KAIZEN - JUIZO_1.wav')).toBe(true);
      expect(isJunkCompanionFile('._2-OhTel.mp3')).toBe(true);
      expect(isJunkCompanionFile('.DS_Store')).toBe(true);
      expect(isJunkCompanionFile('Thumbs.db')).toBe(true);
    });

    it('strictly preserves album artwork and cover image files', () => {
      expect(isJunkCompanionFile('cover.jpg')).toBe(false);
      expect(isJunkCompanionFile('folder.png')).toBe(false);
      expect(isJunkCompanionFile('albumart.jpeg')).toBe(false);
    });

    it('creates violation for desktop.ini in same album folder', () => {
      const v = CompanionJunkCleanupRule.evaluate(baseTrack, {
        discoveredCompanionFiles: [
          'C:/Music/Artist/Album/desktop.ini',
          'C:/Music/Artist/Album/cover.jpg',
        ],
      });

      expect(v).not.toBeNull();
      expect(v?.currentValue).toBe('desktop.ini');
      expect(v?.deleteCompanionFile).toBe('C:/Music/Artist/Album/desktop.ini');
    });
  });

  describe('#61 AutoEmbedFolderArtworkRule', () => {
    it('detects track lacking embedded artwork in folder with cover.jpg', () => {
      const v = AutoEmbedFolderArtworkRule.evaluate(baseTrack, {
        discoveredCompanionFiles: [
          'C:/Music/Artist/Album/cover.jpg',
        ],
      });

      expect(v).not.toBeNull();
      expect(v?.ruleId).toBe('rule-auto-embed-folder-artwork');
      expect(v?.proposedValue).toContain('cover.jpg');
    });

    it('ignores tracks that already have embedded artwork', () => {
      const trackWithArt: Track = {
        ...baseTrack,
        picture: {
          format: 'image/jpeg',
          data: 'data:image/jpeg;base64,12345',
        },
      };

      const v = AutoEmbedFolderArtworkRule.evaluate(trackWithArt, {
        discoveredCompanionFiles: ['C:/Music/Artist/Album/cover.jpg'],
      });

      expect(v).toBeNull();
    });

    it('returns null when no cover image exists in directory', () => {
      const v = AutoEmbedFolderArtworkRule.evaluate(baseTrack, {
        discoveredCompanionFiles: ['C:/Music/Artist/Album/lyrics.txt'],
      });

      expect(v).toBeNull();
    });
  });

  describe('#62 ArtworkDimensionRule', () => {
    it('flags oversized embedded artwork (> 500 KB) without touching master files', () => {
      // 800 KB base64 payload
      const largeBase64 = 'A'.repeat(800 * 1024 * (4 / 3));
      const trackWithLargeArt: Track = {
        ...baseTrack,
        picture: {
          format: 'image/jpeg',
          data: `data:image/jpeg;base64,${largeBase64}`,
        },
      };

      const v = ArtworkDimensionRule.evaluate(trackWithLargeArt);
      expect(v).not.toBeNull();
      expect(v?.ruleId).toBe('rule-artwork-dimension');
      expect(v?.proposedValue).toContain('500x500');
    });

    it('ignores embedded artwork within safe 500 KB limit (e.g. Tyson X 360 KB art)', () => {
      const safeBase64 = 'A'.repeat(300 * 1024 * (4 / 3));
      const trackWithSafeArt: Track = {
        ...baseTrack,
        picture: {
          format: 'image/jpeg',
          data: `data:image/jpeg;base64,${safeBase64}`,
        },
      };

      const v = ArtworkDimensionRule.evaluate(trackWithSafeArt);
      expect(v).toBeNull();
    });

    it('flags oversized companion cover file (> 500 KB) while preserving original master image', () => {
      const coverPath = 'C:/Music/Artist/Album/cover.jpg';
      const v = ArtworkDimensionRule.evaluate(baseTrack, {
        discoveredCompanionFiles: [coverPath],
        discoveredCompanionFileSizes: {
          [coverPath]: 2.5 * 1024 * 1024, // 2.5 MB like OhTel cover.jpg
        },
      });

      expect(v).not.toBeNull();
      expect(v?.ruleId).toBe('rule-artwork-dimension');
      expect(v?.reason).toContain('leaving the master file intact');
    });
  });
});
