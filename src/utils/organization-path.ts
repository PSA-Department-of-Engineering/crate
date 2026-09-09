import { AudioFormat, Track } from '../models/types';

const FORBIDDEN_PATH_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

/**
 * Returns whether a metadata value is a scanner fallback rather than a value
 * supplied by the user or embedded in the audio file.
 */
export function isUnknownMetadataValue(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return !normalized || normalized === 'unknown artist' || normalized === 'unknown album' || normalized === 'unknown title';
}

/**
 * Sanitizes one artist, album, or filename component for Windows/FAT32-safe
 * organization. Path separators are replaced so metadata cannot create a
 * nested path or escape the library root.
 */
export function sanitizeOrganizationSegment(segment: string, replacement = '_'): string {
  if (!segment || segment.trim() === '') {
    return 'Unknown';
  }

  let sanitized = segment.replace(FORBIDDEN_PATH_CHARS, replacement);
  sanitized = sanitized.replace(/[. ]+$/, '').trim();

  if (sanitized.length === 0) {
    sanitized = 'Unknown';
  }

  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(sanitized)) {
    sanitized = `${sanitized}_`;
  }

  return sanitized;
}

export function formatOrganizationTrackNumber(trackNumber?: number): string {
  if (trackNumber === undefined || trackNumber === null || Number.isNaN(trackNumber) || trackNumber <= 0) {
    return '00';
  }
  return trackNumber < 10 ? `0${trackNumber}` : `${trackNumber}`;
}

/**
 * Produces the canonical relative path used by both the local organizer rule
 * and car sync. Album Artist is preferred for the folder so compilations stay
 * together; ordinary tracks fall back to Artist.
 */
export function getOrganizationRelativePath(track: Track, targetFormat: AudioFormat = track.format): string {
  const albumArtist = track.albumArtist?.trim();
  const artist = !isUnknownMetadataValue(albumArtist) ? albumArtist! : track.artist;
  const artistSegment = sanitizeOrganizationSegment(artist || 'Unknown Artist');
  const albumSegment = sanitizeOrganizationSegment(track.album || 'Unknown Album');
  const titleSegment = sanitizeOrganizationSegment(track.title || 'Unknown Title');
  const extension = targetFormat === 'flac' ? '.flac' : targetFormat === 'wav' ? '.wav' : '.mp3';
  const filename = `${formatOrganizationTrackNumber(track.trackNumber)} ${titleSegment}${extension}`;

  return `${artistSegment}/${albumSegment}/${filename}`;
}
