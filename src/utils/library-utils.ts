import { Track, AlbumGroup, ArtistGroup, EmbeddedArtwork } from '../models/types';

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

