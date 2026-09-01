import { useState, useMemo, useCallback } from 'react';
import { Track, TagUpdates, Playlist } from '../models/types';
import { filterTracks, sortTracks } from '../utils/library-utils';

const DEMO_TRACKS: Track[] = [
  {
    id: 'demo-1',
    filePath: 'C:/Music/Pink Floyd/The Dark Side of the Moon/01 Speak to Me.mp3',
    title: 'Speak to Me',
    artist: 'Pink Floyd',
    album: 'The Dark Side of the Moon',
    albumArtist: 'Pink Floyd',
    trackNumber: 1,
    totalTracks: 10,
    year: 1973,
    genre: 'Progressive Rock',
    duration: 68,
    bitrate: 320,
    sampleRate: 44100,
    format: 'mp3',
    fileSize: 2720000,
    mtime: Date.now() - 1000000,
  },
  {
    id: 'demo-2',
    filePath: 'C:/Music/Pink Floyd/The Dark Side of the Moon/02 Breathe (In the Air).mp3',
    title: 'Breathe (In the Air)',
    artist: 'Pink Floyd',
    album: 'The Dark Side of the Moon',
    albumArtist: 'Pink Floyd',
    trackNumber: 2,
    totalTracks: 10,
    year: 1973,
    genre: 'Progressive Rock',
    duration: 163,
    bitrate: 320,
    sampleRate: 44100,
    format: 'mp3',
    fileSize: 6520000,
    mtime: Date.now() - 1000000,
  },
  {
    id: 'demo-3',
    filePath: 'C:/Music/Pink Floyd/The Dark Side of the Moon/03 Time.flac',
    title: 'Time',
    artist: 'Pink Floyd',
    album: 'The Dark Side of the Moon',
    albumArtist: 'Pink Floyd',
    trackNumber: 3,
    totalTracks: 10,
    year: 1973,
    genre: 'Progressive Rock',
    duration: 413,
    bitrate: 940,
    sampleRate: 44100,
    format: 'flac',
    fileSize: 32100000,
    mtime: Date.now() - 1000000,
  },
  {
    id: 'demo-4',
    filePath: 'C:/Music/Daft Punk/Random Access Memories/01 Give Life Back to Music.flac',
    title: 'Give Life Back to Music',
    artist: 'Daft Punk',
    album: 'Random Access Memories',
    albumArtist: 'Daft Punk',
    trackNumber: 1,
    totalTracks: 13,
    year: 2013,
    genre: 'Electronic / Disco',
    duration: 274,
    bitrate: 1010,
    sampleRate: 88200,
    format: 'flac',
    fileSize: 34500000,
    mtime: Date.now() - 2000000,
  },
  {
    id: 'demo-5',
    filePath: 'C:/Music/Daft Punk/Random Access Memories/08 Get Lucky.mp3',
    title: 'Get Lucky',
    artist: 'Daft Punk ft. Pharrell Williams',
    album: 'Random Access Memories',
    albumArtist: 'Daft Punk',
    trackNumber: 8,
    totalTracks: 13,
    year: 2013,
    genre: 'Electronic / Disco',
    duration: 369,
    bitrate: 320,
    sampleRate: 44100,
    format: 'mp3',
    fileSize: 14760000,
    mtime: Date.now() - 2000000,
  },
  {
    id: 'demo-6',
    filePath: 'C:/Music/Miles Davis/Kind of Blue/01 So What.flac',
    title: 'So What',
    artist: 'Miles Davis',
    album: 'Kind of Blue',
    albumArtist: 'Miles Davis',
    trackNumber: 1,
    totalTracks: 5,
    year: 1959,
    genre: 'Modal Jazz',
    duration: 562,
    bitrate: 850,
    sampleRate: 96000,
    format: 'flac',
    fileSize: 58000000,
    mtime: Date.now() - 3000000,
  }
];

export type SortField = 'artist' | 'album' | 'title' | 'trackNumber' | 'year' | 'genre' | 'duration';
export type SortDirection = 'asc' | 'desc';

export function useLibrary() {
  const [tracks, setTracks] = useState<Track[]>(DEMO_TRACKS);
  const [libraryPath, setLibraryPath] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [corruptFiles, setCorruptFiles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('artist');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([
    {
      id: 'pl-roadtrip',
      name: 'Road Trip Favorites',
      trackIds: ['demo-1', 'demo-2', 'demo-3', 'demo-5'],
      createdAt: Date.now() - 500000,
      updatedAt: Date.now() - 500000,
    },
    {
      id: 'pl-nightdrive',
      name: 'Night Drive',
      trackIds: ['demo-4', 'demo-6'],
      createdAt: Date.now() - 300000,
      updatedAt: Date.now() - 300000,
    }
  ]);

  // Filtered and sorted tracks computation
  const filteredAndSortedTracks = useMemo(() => {
    const filtered = filterTracks(tracks, searchQuery);
    return sortTracks(filtered, sortField, sortDirection);
  }, [tracks, searchQuery, sortField, sortDirection]);

  // Distinct albums list
  const albums = useMemo(() => {
    const map = new Map<string, { name: string; artist: string; trackCount: number; year?: number }>();
    for (const t of tracks) {
      if (!t.album) continue;
      const key = t.album.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: t.album,
          artist: t.albumArtist || t.artist,
          trackCount: 1,
          year: t.year,
        });
      } else {
        const item = map.get(key)!;
        item.trackCount++;
      }
    }
    return Array.from(map.values());
  }, [tracks]);

  // Open directory dialog & scan library
  const chooseAndScanFolder = useCallback(async () => {
    if (typeof window !== 'undefined' && window.crateBridge) {
      const folder = await window.crateBridge.selectLibraryFolder();
      if (folder) {
        setLibraryPath(folder);
        setIsScanning(true);
        try {
          const result = await window.crateBridge.scanLibrary(folder);
          setTracks(result.tracks);
          setCorruptFiles(result.corruptFiles);
        } catch (err) {
          console.error('Library scan failed:', err);
        } finally {
          setIsScanning(false);
        }
      }
    }
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const toggleSelectTrack = useCallback((trackId: string, multi: boolean = false) => {
    setSelectedTrackIds(prev => {
      if (multi) {
        return prev.includes(trackId)
          ? prev.filter(id => id !== trackId)
          : [...prev, trackId];
      } else {
        return prev.includes(trackId) && prev.length === 1 ? [] : [trackId];
      }
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedTrackIds(filteredAndSortedTracks.map(t => t.id));
  }, [filteredAndSortedTracks]);

  const clearSelection = useCallback(() => {
    setSelectedTrackIds([]);
  }, []);

  // Update track metadata on disk & in memory
  const updateTrackTags = useCallback(async (filePath: string, tags: TagUpdates) => {
    if (typeof window !== 'undefined' && window.crateBridge && window.crateBridge.isElectron) {
      try {
        const updatedTrack = await window.crateBridge.saveTrackTags(filePath, tags);
        setTracks(prev => prev.map(t => (t.filePath === filePath ? updatedTrack : t)));
        return updatedTrack;
      } catch (err) {
        console.error('Tag save failed:', err);
        throw err;
      }
    } else {
      // In-memory update for browser fallback / demo
      setTracks(prev => prev.map(t => {
        if (t.filePath === filePath || t.id === filePath) {
          return {
            ...t,
            title: tags.title !== undefined ? tags.title : t.title,
            artist: tags.artist !== undefined ? tags.artist : t.artist,
            album: tags.album !== undefined ? tags.album : t.album,
            albumArtist: tags.albumArtist !== undefined ? tags.albumArtist : t.albumArtist,
            year: tags.year !== undefined ? tags.year : t.year,
            genre: tags.genre !== undefined ? tags.genre : t.genre,
            trackNumber: tags.trackNumber !== undefined ? tags.trackNumber : t.trackNumber,
            totalTracks: tags.totalTracks !== undefined ? tags.totalTracks : t.totalTracks,
            discNumber: tags.discNumber !== undefined ? tags.discNumber : t.discNumber,
            totalDiscs: tags.totalDiscs !== undefined ? tags.totalDiscs : t.totalDiscs,
            picture: tags.picture !== undefined ? (tags.picture ? { format: tags.picture.format, data: tags.picture.data } : undefined) : t.picture,
          };
        }
        return t;
      }));
    }
  }, []);

  // Batch update multiple tracks
  const batchUpdateTags = useCallback(async (filePaths: string[], tags: TagUpdates) => {
    if (typeof window !== 'undefined' && window.crateBridge && window.crateBridge.isElectron) {
      try {
        const updatedTracks = await window.crateBridge.batchSaveTags(filePaths, tags);
        const map = new Map(updatedTracks.map(t => [t.filePath, t]));
        setTracks(prev => prev.map(t => map.get(t.filePath) || t));
        return updatedTracks;
      } catch (err) {
        console.error('Batch tag save failed:', err);
        throw err;
      }
    } else {
      const pathSet = new Set(filePaths);
      setTracks(prev => prev.map(t => {
        if (pathSet.has(t.filePath) || pathSet.has(t.id)) {
          return {
            ...t,
            artist: tags.artist !== undefined && tags.artist !== '' ? tags.artist : t.artist,
            album: tags.album !== undefined && tags.album !== '' ? tags.album : t.album,
            albumArtist: tags.albumArtist !== undefined && tags.albumArtist !== '' ? tags.albumArtist : t.albumArtist,
            year: tags.year !== undefined ? tags.year : t.year,
            genre: tags.genre !== undefined && tags.genre !== '' ? tags.genre : t.genre,
            totalTracks: tags.totalTracks !== undefined ? tags.totalTracks : t.totalTracks,
            totalDiscs: tags.totalDiscs !== undefined ? tags.totalDiscs : t.totalDiscs,
            picture: tags.picture !== undefined ? (tags.picture ? { format: tags.picture.format, data: tags.picture.data } : undefined) : t.picture,
          };
        }
        return t;
      }));
    }
  }, []);

  // Playlist management
  const createPlaylist = useCallback((name: string, trackIds: string[] = []) => {
    const newPl: Playlist = {
      id: `pl-${Date.now()}`,
      name,
      trackIds,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setPlaylists(prev => [...prev, newPl]);
    return newPl;
  }, []);

  const addTracksToPlaylist = useCallback((playlistId: string, newTrackIds: string[]) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id === playlistId) {
        const set = new Set([...pl.trackIds, ...newTrackIds]);
        return { ...pl, trackIds: Array.from(set), updatedAt: Date.now() };
      }
      return pl;
    }));
  }, []);

  const deletePlaylist = useCallback((playlistId: string) => {
    setPlaylists(prev => prev.filter(pl => pl.id !== playlistId));
  }, []);

  return {
    tracks,
    filteredAndSortedTracks,
    libraryPath,
    isScanning,
    corruptFiles,
    searchQuery,
    setSearchQuery,
    sortField,
    sortDirection,
    handleSort,
    selectedTrackIds,
    toggleSelectTrack,
    selectAll,
    clearSelection,
    chooseAndScanFolder,
    updateTrackTags,
    batchUpdateTags,
    albums,
    playlists,
    createPlaylist,
    addTracksToPlaylist,
    deletePlaylist,
  };
}
