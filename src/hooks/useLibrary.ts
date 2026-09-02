import { useState, useMemo, useCallback, useEffect } from 'react';
import { Track, TagUpdates, Playlist } from '../models/types';
import { filterTracks, sortTracks } from '../utils/library-utils';

export type SortField = 'artist' | 'album' | 'title' | 'trackNumber' | 'year' | 'genre' | 'duration';
export type SortDirection = 'asc' | 'desc';

export function useLibrary() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [libraryPath, setLibraryPath] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(true);
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(false);
  const [corruptFiles, setCorruptFiles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('artist');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  // Scan a specified directory path
  const scanFolder = useCallback(async (folder: string) => {
    if (typeof window !== 'undefined' && window.crateBridge) {
      setIsScanning(true);
      try {
        const result = await window.crateBridge.scanLibrary(folder);
        setTracks(result.tracks);
        setCorruptFiles(result.corruptFiles);
        return result;
      } catch (err) {
        console.error('Library scan failed:', err);
        throw err;
      } finally {
        setIsScanning(false);
      }
    }
    return null;
  }, []);

  // Initialize stored library path from AppData on startup
  useEffect(() => {
    let isMounted = true;

    const initStoredPath = async () => {
      setIsLoadingSettings(true);
      try {
        let storedPath: string | null = null;
        if (typeof window !== 'undefined' && window.crateBridge?.getStoredLibraryPath) {
          storedPath = await window.crateBridge.getStoredLibraryPath();
        } else if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          storedPath = localStorage.getItem('crate_library_path');
        }

        if (!isMounted) return;

        if (storedPath && storedPath.trim() !== '') {
          setLibraryPath(storedPath);
          setShowOnboardingModal(false);

          // Auto-scan saved library path
          if (typeof window !== 'undefined' && window.crateBridge?.scanLibrary) {
            setIsScanning(true);
            try {
              const result = await window.crateBridge.scanLibrary(storedPath);
              if (isMounted) {
                setTracks(result.tracks);
                setCorruptFiles(result.corruptFiles);
              }
            } catch (err) {
              console.error('Auto-scan of stored library path failed:', err);
            } finally {
              if (isMounted) setIsScanning(false);
            }
          }
        } else {
          setLibraryPath(null);
          setShowOnboardingModal(true);
        }
      } catch (err) {
        console.error('Failed to load stored library path from settings:', err);
        if (isMounted) {
          setShowOnboardingModal(true);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSettings(false);
        }
      }
    };

    initStoredPath();

    return () => {
      isMounted = false;
    };
  }, []);

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

  // Open directory dialog, persist selection to AppData, & scan library
  const chooseAndScanFolder = useCallback(async () => {
    if (typeof window !== 'undefined' && window.crateBridge) {
      const folder = await window.crateBridge.selectLibraryFolder();
      if (folder) {
        setLibraryPath(folder);
        setShowOnboardingModal(false);

        // Persist to AppData via bridge
        try {
          if (window.crateBridge.setStoredLibraryPath) {
            await window.crateBridge.setStoredLibraryPath(folder);
          }
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('crate_library_path', folder);
          }
        } catch (err) {
          console.error('Failed to persist library path to settings:', err);
        }

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
    isLoadingSettings,
    showOnboardingModal,
    setShowOnboardingModal,
    scanFolder,
    corruptFiles,
    searchQuery,
    setSearchQuery,
    sortField,
    sortDirection,
    handleSort,
    selectedTrackIds,
    setSelectedTrackIds,
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
