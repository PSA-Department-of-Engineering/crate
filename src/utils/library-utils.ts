import { Track, AlbumGroup, ArtistGroup, EmbeddedArtwork } from '../models/types';

const UNKNOWN_METADATA_VALUES = new Set(['unknown artist', 'unknown album', 'unknown title']);

function isMissingMetadataValue(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return !normalized || UNKNOWN_METADATA_VALUES.has(normalized);
}

/**
 * Returns the user-fixable metadata problems currently represented by a track.
 *
 * The scanner preserves fallback values such as "Unknown Artist" and marks
 * unreadable files with `isCorrupt`, so the library can surface these problems
 * without making another filesystem read during rendering.
 */
export function getTrackMetadataIssues(track: Track): string[] {
  const issues: string[] = [];

  if (track.isCorrupt) {
    issues.push('Unreadable metadata');
  }
  if (isMissingMetadataValue(track.title)) {
    issues.push('Missing title');
  }
  if (isMissingMetadataValue(track.artist)) {
    issues.push('Missing artist');
  }
  if (isMissingMetadataValue(track.album)) {
    issues.push('Missing album');
  }

  const trackNumber = track.trackNumber;
  const hasValidTrackNumber =
    typeof trackNumber === 'number' &&
    Number.isFinite(trackNumber) &&
    trackNumber > 0;
  if (!hasValidTrackNumber) {
    issues.push('Missing track number');
  } else if (
    track.totalTracks !== undefined &&
    (!Number.isFinite(track.totalTracks) || track.totalTracks < 1 || trackNumber > track.totalTracks)
  ) {
    issues.push('Invalid track count');
  }

  if (
    track.discNumber !== undefined &&
    (!Number.isFinite(track.discNumber) || track.discNumber < 1)
  ) {
    issues.push('Invalid disc number');
  } else if (
    track.totalDiscs !== undefined &&
    (!Number.isFinite(track.totalDiscs) ||
      track.totalDiscs < 1 ||
      (track.discNumber !== undefined && track.discNumber > track.totalDiscs))
  ) {
    issues.push('Invalid disc count');
  }

  return issues;
}

export interface MetadataIssueSummary {
  affectedTracks: Track[];
  issueTypes: string[];
}

/** Summarizes metadata issues for collection cards without duplicating rules in the UI. */
export function summarizeMetadataIssues(tracks: Track[]): MetadataIssueSummary {
  const issueTypes = new Set<string>();
  const affectedTracks = tracks.filter((track) => {
    const issues = getTrackMetadataIssues(track);
    issues.forEach((issue) => issueTypes.add(issue));
    return issues.length > 0;
  });

  return {
    affectedTracks,
    issueTypes: Array.from(issueTypes),
  };
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function formatTotalPlaytime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }
  return `${minutes} min`;
}

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

export function groupTracksByAlbum(tracks: Track[]): AlbumGroup[] {
  const map = new Map<string, AlbumGroup>();

  for (const t of tracks) {
    const albumName = t.album || 'Unknown Album';
    const artistName = t.albumArtist || t.artist || 'Unknown Artist';
    const key = `${artistName.toLowerCase()}:::${albumName.toLowerCase()}`;

    if (!map.has(key)) {
      map.set(key, {
        albumName,
        artistName,
        year: t.year,
        genre: t.genre,
        trackCount: 1,
        totalDuration: t.duration || 0,
        artwork: t.picture,
        tracks: [t],
      });
    } else {
      const group = map.get(key)!;
      group.trackCount += 1;
      group.totalDuration += t.duration || 0;
      if (!group.artwork && t.picture) {
        group.artwork = t.picture;
      }
      if (!group.year && t.year) {
        group.year = t.year;
      }
      if (!group.genre && t.genre) {
        group.genre = t.genre;
      }
      group.tracks.push(t);
    }
  }

  // Sort tracks within each album by discNumber then trackNumber
  for (const group of map.values()) {
    group.tracks.sort((a, b) => {
      const discA = a.discNumber || 1;
      const discB = b.discNumber || 1;
      if (discA !== discB) return discA - discB;
      const trkA = a.trackNumber || 0;
      const trkB = b.trackNumber || 0;
      if (trkA !== trkB) return trkA - trkB;
      return a.title.localeCompare(b.title);
    });
  }

  // Sort albums alphabetically / by year
  return Array.from(map.values()).sort((a, b) => {
    if (a.year && b.year && a.year !== b.year) {
      return a.year - b.year;
    }
    return a.albumName.localeCompare(b.albumName);
  });
}

export function groupTracksByArtist(tracks: Track[]): ArtistGroup[] {
  const map = new Map<string, { artistName: string; tracks: Track[] }>();

  for (const t of tracks) {
    const artistName = t.albumArtist || t.artist || 'Unknown Artist';
    const key = artistName.toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        artistName,
        tracks: [t],
      });
    } else {
      map.get(key)!.tracks.push(t);
    }
  }

  const artists: ArtistGroup[] = [];

  for (const item of map.values()) {
    const albums = groupTracksByAlbum(item.tracks);
    const totalDuration = item.tracks.reduce((acc, trk) => acc + (trk.duration || 0), 0);

    // Collect up to 4 distinct album artworks for mosaic display
    const artworks: EmbeddedArtwork[] = [];
    const seenArtworks = new Set<string>();
    for (const alb of albums) {
      if (alb.artwork && alb.artwork.data && !seenArtworks.has(alb.artwork.data)) {
        seenArtworks.add(alb.artwork.data);
        artworks.push(alb.artwork);
        if (artworks.length >= 4) break;
      }
    }

    artists.push({
      artistName: item.artistName,
      albumCount: albums.length,
      trackCount: item.tracks.length,
      totalDuration,
      artworks,
      albums,
      tracks: item.tracks,
    });
  }

  return artists.sort((a, b) => a.artistName.localeCompare(b.artistName));
}

export interface ArtworkCandidate {
  track: Track;
  artwork?: EmbeddedArtwork;
}

/**
 * Derives distinct artwork candidates from an artist's albums for mosaic rendering.
 * When albums share identical cover art (e.g. after setting an artist-wide cover image,
 * or when multi-disc / multiple releases share the same art), duplicates are deduplicated
 * so the same image is never displayed multiple times side by side.
 */
export function getDistinctArtworkCandidates(
  albums: AlbumGroup[],
  loadedArtworks?: Map<string, EmbeddedArtwork | null>
): ArtworkCandidate[] {
  const candidates: ArtworkCandidate[] = [];
  let allResolved = true;

  for (const album of albums) {
    const track = album.tracks[0];
    if (!track) continue;

    let artwork: EmbeddedArtwork | undefined;
    if (loadedArtworks && loadedArtworks.has(track.filePath)) {
      artwork = loadedArtworks.get(track.filePath) ?? undefined;
    } else {
      artwork = album.artwork || track.picture;
      if (!artwork) {
        allResolved = false;
      }
    }

    candidates.push({ track, artwork });
  }

  // If any candidates have artwork, deduplicate by artwork data
  const withArtwork = candidates.filter((c) => c.artwork?.data);
  if (withArtwork.length > 0) {
    const distinct: ArtworkCandidate[] = [];
    const seenData = new Set<string>();

    for (const c of withArtwork) {
      const key = c.artwork!.data.trim();
      if (!seenData.has(key)) {
        seenData.add(key);
        distinct.push(c);
      }
    }

    return distinct.slice(0, 4);
  }

  // If all candidates have resolved and none have artwork, return empty list for fallback
  if (allResolved && loadedArtworks && loadedArtworks.size > 0) {
    return [];
  }

  // If artwork is still pending for some or all albums, return candidate tracks
  return candidates.slice(0, 4);
}


/**
 * Builds the post-scan summary line, e.g.
 * "Imported 4,812 tracks. 7 files could not be read."
 *
 * Unreadable files are kept in the track list as `isCorrupt` placeholders, so
 * they are subtracted from the imported count rather than added to it.
 */
export function formatImportSummary(trackCount: number, corruptCount: number): string {
  const imported = Math.max(0, trackCount - corruptCount);
  const importedText = `Imported ${imported.toLocaleString('en-US')} ${imported === 1 ? 'track' : 'tracks'}.`;
  if (corruptCount <= 0) {
    return importedText;
  }
  const failedText = `${corruptCount.toLocaleString('en-US')} ${corruptCount === 1 ? 'file' : 'files'} could not be read.`;
  return `${importedText} ${failedText}`;
}
