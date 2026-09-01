import { Track } from '../models/types';

export function filterTracks(tracks: Track[], query: string): Track[] {
  if (!query || query.trim() === '') {
    return tracks;
  }

  const lowerQuery = query.toLowerCase().trim();

  return tracks.filter(t => {
    if (t.title && t.title.toLowerCase().includes(lowerQuery)) return true;
    if (t.artist && t.artist.toLowerCase().includes(lowerQuery)) return true;
    if (t.album && t.album.toLowerCase().includes(lowerQuery)) return true;
    if (t.albumArtist && t.albumArtist.toLowerCase().includes(lowerQuery)) return true;
    if (t.genre && t.genre.toLowerCase().includes(lowerQuery)) return true;
    if (t.year && t.year.toString().includes(lowerQuery)) return true;
    if (t.trackNumber && t.trackNumber.toString() === lowerQuery) return true;
    if (t.filePath && t.filePath.toLowerCase().includes(lowerQuery)) return true;
    return false;
  });
}

export function sortTracks(
  tracks: Track[],
  field: 'artist' | 'album' | 'title' | 'trackNumber' | 'year' | 'genre' | 'duration',
  direction: 'asc' | 'desc' = 'asc'
): Track[] {
  const modifier = direction === 'asc' ? 1 : -1;

  return [...tracks].sort((a, b) => {
    let valA: any = a[field];
    let valB: any = b[field];

    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (typeof valA === 'string') {
      return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' }) * modifier;
    }

    if (valA < valB) return -1 * modifier;
    if (valA > valB) return 1 * modifier;
    return 0;
  });
}
