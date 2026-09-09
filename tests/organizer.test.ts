import { describe, expect } from 'vitest';
import { intent } from './intent-helper';
import {
  getCarRelativePath,
  sanitizeFat32Segment,
  formatTrackNumber,
} from '../electron/services/file-organizer';
import { Track } from '../src/models/types';

describe('Filesystem Organizer & Path Sanitization', () => {
  intent('INT-ORG-001', 'Organizer formats files into Artist/Album/Track Title pattern', async () => {
    const track: Track = {
      id: '1',
      filePath: 'raw/song.mp3',
      title: 'Comfortably Numb',
      artist: 'Pink Floyd',
      album: 'The Wall',
      trackNumber: 6,
      format: 'mp3',
      duration: 382,
      fileSize: 10000000,
      mtime: 1000,
    };

    const relPath = getCarRelativePath(track);
    expect(relPath).toBe('Pink Floyd/The Wall/06 Comfortably Numb.mp3');
  });

  intent('INT-ORG-002', 'Organizer consolidates multi-disc albums into one folder with no disc subfolder', async () => {
    // A disc-2 track whose number has already been made continuous across discs
    // (13 = disc 1 had 12 tracks) lands in the single album folder, not a
    // "Disc 2" subfolder, and the disc number is carried in metadata only.
    const trackDisc2: Track = {
      id: '2',
      filePath: 'raw/hey_you.flac',
      title: 'Hey You',
      artist: 'Pink Floyd',
      album: 'The Wall',
      trackNumber: 13,
      discNumber: 2,
      totalDiscs: 2,
      format: 'flac',
      duration: 280,
      fileSize: 20000000,
      mtime: 1000,
    };

    const relPath = getCarRelativePath(trackDisc2);
    expect(relPath).toBe('Pink Floyd/The Wall/13 Hey You.flac');
    expect(relPath).not.toMatch(/\/Disc \d/i);
  });

  intent('INT-ORG-003', 'Path sanitizer replaces illegal FAT32/exFAT characters and trims trailing spaces/dots', async () => {
    // Invariant: FAT32 path sanitization replaces illegal characters and trims trailing dots/spaces
    expect(sanitizeFat32Segment('AC/DC')).toBe('AC_DC');
    expect(sanitizeFat32Segment('What? Why*: "Special" | <Track>')).toBe('What_ Why__ _Special_ _ _Track_');
    expect(sanitizeFat32Segment('Trailing Dots....')).toBe('Trailing Dots');
    expect(sanitizeFat32Segment('  Whitespace Trimmed  ')).toBe('Whitespace Trimmed');
    expect(sanitizeFat32Segment('CON')).toBe('CON_'); // Windows reserved device name
    expect(sanitizeFat32Segment('')).toBe('Unknown');
  });
});
