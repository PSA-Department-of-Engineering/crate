import { describe, it, expect } from 'vitest';
import {
  ZeroPadTrackNumberRule,
  EnforceTrackNumberPrefixRule,
  StripPromoJunkRule,
  MultiDiscStandardizerRule,
  FilesystemSanitizeRule,
  CompanionJunkCleanupRule,
  isJunkCompanionFile,
} from '../src/services/rules';
import { Track } from '../src/models/types';

describe('Core Rule Implementations (#45 - #50)', () => {
  const baseTrack: Track = {
    id: 'test-track-1',
    filePath: 'C:/Music/50 Cent/The Massacre/1. Intro (Produced by Eminem).mp3',
    title: 'Intro (Produced by Eminem)',
    artist: '50 Cent',
    album: 'The Massacre',
    trackNumber: 1,
    duration: 41,
    format: 'mp3',
    fileSize: 1678666,
    mtime: Date.now(),
  };

  describe('#45 ZeroPadTrackNumberRule', () => {
    it('pads single-digit track numbers with leading zero', () => {
      const v = ZeroPadTrackNumberRule.evaluate(baseTrack);
      expect(v).not.toBeNull();
      expect(v?.currentValue).toBe('1. Intro (Produced by Eminem).mp3');
      expect(v?.proposedValue).toBe('01. Intro (Produced by Eminem).mp3');
      expect(v?.proposedRenamePath).toBe('C:/Music/50 Cent/The Massacre/01. Intro (Produced by Eminem).mp3');
    });

    it('ignores files that are already zero-padded or 2-digit', () => {
      const paddedTrack = { ...baseTrack, filePath: 'C:/Music/50 Cent/The Massacre/01. Intro.mp3' };
      const twoDigitTrack = { ...baseTrack, filePath: 'C:/Music/50 Cent/The Massacre/10. Ski Mask Way.mp3' };

      expect(ZeroPadTrackNumberRule.evaluate(paddedTrack)).toBeNull();
      expect(ZeroPadTrackNumberRule.evaluate(twoDigitTrack)).toBeNull();
    });
  });

  describe('#46 EnforceTrackNumberPrefixRule', () => {
    it('prepends zero-padded track number from metadata to filename lacking number', () => {
      const uziTrack: Track = {
        ...baseTrack,
        filePath: 'C:/Music/Lil Uzi Vert/LUV Vs. The World 2/Myron.mp3',
        title: 'Myron',
        artist: 'Lil Uzi Vert',
        album: 'LUV Vs. The World 2',
        trackNumber: 1,
      };

      const v = EnforceTrackNumberPrefixRule.evaluate(uziTrack);
      expect(v).not.toBeNull();
      expect(v?.currentValue).toBe('Myron.mp3');
      expect(v?.proposedValue).toBe('01 Myron.mp3');
      expect(v?.proposedRenamePath).toBe('C:/Music/Lil Uzi Vert/LUV Vs. The World 2/01 Myron.mp3');
    });

    it('prepends 2-digit track number without extra padding if >= 10', () => {
      const uziTrack12: Track = {
        ...baseTrack,
        filePath: 'C:/Music/Lil Uzi Vert/LUV Vs. The World 2/Money Spread.mp3',
        trackNumber: 12,
      };

      const v = EnforceTrackNumberPrefixRule.evaluate(uziTrack12);
      expect(v?.proposedValue).toBe('12 Money Spread.mp3');
    });

    it('ignores tracks that already start with digits or have no metadata track number', () => {
      const existingPrefix = { ...baseTrack, filePath: 'C:/Music/Album/01 Track.mp3' };
      const noTrackNum = { ...baseTrack, trackNumber: undefined, filePath: 'C:/Music/Album/Track.mp3' };

      expect(EnforceTrackNumberPrefixRule.evaluate(existingPrefix)).toBeNull();
      expect(EnforceTrackNumberPrefixRule.evaluate(noTrackNum)).toBeNull();
    });
  });

  describe('#47 StripPromoJunkRule', () => {
    it('strips download URLs, promo tags and messy underscores from filenames', () => {
      const promoTrack: Track = {
        ...baseTrack,
        filePath: 'C:/Music/50 Cent/The Kanan Tape/01_-_Nigga_Nigga_Ft_Lil_Boosie--(MixJoint.com).mp3',
        title: 'Nigga Nigga Ft Lil Boosie--(MixJoint.com)',
      };

      const v = StripPromoJunkRule.evaluate(promoTrack);
      expect(v).not.toBeNull();
      expect(v?.proposedValue).not.toContain('MixJoint.com');
      expect(v?.proposedValue).not.toContain('_-_');
    });

    it('strictly preserves legitimate artist feature credits', () => {
      const featureTrack: Track = {
        ...baseTrack,
        filePath: 'C:/Music/Bas/Too High To Riot/03 - Dopamine (feat. Cozz).mp3',
        title: 'Dopamine (feat. Cozz)',
      };

      const v = StripPromoJunkRule.evaluate(featureTrack);
      expect(v).toBeNull();
    });
  });

  describe('#48 MultiDiscStandardizerRule', () => {
    it('flattens disc folders and computes continuous track numbering across discs', () => {
      const disc1Track: Track = {
        ...baseTrack,
        id: 'disc1-1',
        filePath: 'C:/Music/Eminem/MMLP2/Disc 1/01 Bad Guy.mp3',
        album: 'The Marshall Mathers LP 2',
        discNumber: 1,
        trackNumber: 1,
      };

      const disc2Track: Track = {
        ...baseTrack,
        id: 'disc2-1',
        filePath: 'C:/Music/Eminem/MMLP2/Disc 2/01 Baby.mp3',
        album: 'The Marshall Mathers LP 2',
        discNumber: 2,
        trackNumber: 1,
      };

      // Mock album where Disc 1 has 16 tracks
      const allAlbumTracks: Track[] = [
        ...Array.from({ length: 16 }, (_, i) => ({
          ...baseTrack,
          id: `disc1-${i + 1}`,
          filePath: `C:/Music/Eminem/MMLP2/Disc 1/${i + 1 < 10 ? '0' : ''}${i + 1} Song.mp3`,
          album: 'The Marshall Mathers LP 2',
          discNumber: 1,
          trackNumber: i + 1,
        })),
        disc2Track,
      ];

      const v1 = MultiDiscStandardizerRule.evaluate(disc1Track, { allTracks: allAlbumTracks });
      expect(v1).not.toBeNull();
      expect(v1?.proposedRenamePath).toBe('C:/Music/Eminem/MMLP2/01 Bad Guy.mp3');
      expect(v1?.proposedTagUpdates?.discNumber).toBe(1);

      const v2 = MultiDiscStandardizerRule.evaluate(disc2Track, { allTracks: allAlbumTracks });
      expect(v2).not.toBeNull();
      // Disc 1 has 16 tracks, so Disc 2 Track 1 becomes Track 17!
      expect(v2?.proposedValue).toBe('17 Baby.mp3');
      expect(v2?.proposedRenamePath).toBe('C:/Music/Eminem/MMLP2/17 Baby.mp3');
      expect(v2?.proposedTagUpdates?.discNumber).toBe(2);
      expect(v2?.proposedTagUpdates?.totalDiscs).toBe(2);
    });
  });

  describe('#49 FilesystemSanitizeRule', () => {
    it('sanitizes OS-forbidden characters (: * ? " < > |) and trailing dots/spaces', () => {
      const illegalTrack: Track = {
        ...baseTrack,
        filePath: 'C:/Music/Artist/Album/What\'s Next?.mp3',
      };

      const v = FilesystemSanitizeRule.evaluate(illegalTrack);
      expect(v).not.toBeNull();
      expect(v?.proposedValue).toBe("What's Next.mp3");
    });

    it('strictly preserves safe characters like $, curly quotes ’, &, and brackets', () => {
      const safeTrack: Track = {
        ...baseTrack,
        filePath: 'C:/Music/A$AP Rocky/AT.LONG.LAST.A$AP/01. Can’t You See [Remix].mp3',
      };

      const v = FilesystemSanitizeRule.evaluate(safeTrack);
      expect(v).toBeNull();
    });
  });

  describe('#50 CompanionJunkCleanupRule', () => {
    it('identifies .url and .txt companion files for deletion', () => {
      expect(isJunkCompanionFile('promo.url')).toBe(true);
      expect(isJunkCompanionFile('info.txt')).toBe(true);
      expect(isJunkCompanionFile('guide.nfo')).toBe(true);
      expect(isJunkCompanionFile('.DS_Store')).toBe(true);
      expect(isJunkCompanionFile('Thumbs.db')).toBe(true);
    });

    it('STRICTLY protects cover art and images from being deleted', () => {
      expect(isJunkCompanionFile('Cover.jpg')).toBe(false);
      expect(isJunkCompanionFile('cover.png')).toBe(false);
      expect(isJunkCompanionFile('folder.jpg')).toBe(false);
      expect(isJunkCompanionFile('00-cover.jpg')).toBe(false);
      expect(isJunkCompanionFile('artwork.webp')).toBe(false);
    });

    it('generates violation for junk file in same album directory', () => {
      const v = CompanionJunkCleanupRule.evaluate(baseTrack, {
        discoveredCompanionFiles: [
          'C:/Music/50 Cent/The Massacre/Cover.jpg',
          'C:/Music/50 Cent/The Massacre/Download Link.url',
        ],
      });

      expect(v).not.toBeNull();
      expect(v?.currentValue).toBe('Download Link.url');
      expect(v?.deleteCompanionFile).toBe('C:/Music/50 Cent/The Massacre/Download Link.url');
    });
  });
});
