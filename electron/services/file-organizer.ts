import * as path from 'path';
import { Track } from '../../src/models/types';

/**
 * Forbidden characters in FAT32, exFAT, and Windows filesystems:
 * < (less than), > (greater than), : (colon), " (double quote),
 * / (forward slash), \ (backslash), | (vertical bar or pipe),
 * ? (question mark), * (asterisk), ASCII control characters (0-31).
 */
const FORBIDDEN_FAT32_REGEX = /[<>:"/\\|?*\x00-\x1F]/g;

/**
 * Sanitizes a single path segment (folder name or filename) for FAT32/exFAT compatibility.
 */
export function sanitizeFat32Segment(segment: string, replacement: string = '_'): string {
  if (!segment || segment.trim() === '') {
    return 'Unknown';
  }

  let sanitized = segment.replace(FORBIDDEN_FAT32_REGEX, replacement);

  // Remove trailing dots and spaces which are illegal on FAT32/Windows
  sanitized = sanitized.replace(/[. ]+$/, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // If entirely empty after sanitization, fallback
  if (sanitized.length === 0) {
    sanitized = 'Unknown';
  }

  // Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  const reservedRegex = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reservedRegex.test(sanitized)) {
    sanitized = `${sanitized}_`;
  }

  return sanitized;
}

/**
 * Formats a track number into a 2-digit zero-padded string (e.g. 1 -> "01").
 */
export function formatTrackNumber(trackNum?: number): string {
  if (trackNum === undefined || trackNum === null || isNaN(trackNum) || trackNum <= 0) {
    return '00';
  }
  return trackNum < 10 ? `0${trackNum}` : `${trackNum}`;
}

export interface OrganizationOptions {
  multiDiscSubfolder?: boolean; // true for "Disc 1/01 Title.mp3", false for "1-01 Title.mp3"
}

/**
 * Generates the car-compatible relative destination path for a given track:
 * Pattern: <Artist>/<Album>/<Track#> <Title>.<ext>
 * Multi-disc: <Artist>/<Album>/Disc <N>/<Track#> <Title>.<ext>
 */
export function getCarRelativePath(track: Track, options: OrganizationOptions = { multiDiscSubfolder: true }): string {
  const artist = sanitizeFat32Segment(track.artist || track.albumArtist || 'Unknown Artist');
  const album = sanitizeFat32Segment(track.album || 'Unknown Album');
  const title = sanitizeFat32Segment(track.title || 'Unknown Title');
  const trackNumStr = formatTrackNumber(track.trackNumber);
  const ext = track.format === 'flac' ? '.flac' : '.mp3';

  let filename = `${trackNumStr} ${title}${ext}`;

  if (track.discNumber && track.discNumber > 0 && track.totalDiscs && track.totalDiscs > 1) {
    if (options.multiDiscSubfolder) {
      const discFolder = `Disc ${track.discNumber}`;
      return path.join(artist, album, discFolder, filename).replace(/\\/g, '/');
    } else {
      filename = `${track.discNumber}-${trackNumStr} ${title}${ext}`;
    }
  }

  return path.join(artist, album, filename).replace(/\\/g, '/');
}
