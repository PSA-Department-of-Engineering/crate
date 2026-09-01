import { useState, useEffect, useCallback } from 'react';
import { VolumeInfo, SyncPlan, SyncProgress, Track, Playlist } from '../models/types';

const DEMO_VOLUMES: VolumeInfo[] = [
  {
    driveLetter: 'E:',
    mountPath: 'E:\\',
    label: 'SANDISK_32G (Car USB)',
    totalSpace: 32 * 1024 * 1024 * 1024,
    freeSpace: 24.5 * 1024 * 1024 * 1024,
    isRemovable: true,
  },
  {
    driveLetter: 'F:',
    mountPath: 'F:\\',
    label: 'SD_AUDIO_64G (Head Unit SD)',
    totalSpace: 64 * 1024 * 1024 * 1024,
    freeSpace: 52.1 * 1024 * 1024 * 1024,
    isRemovable: true,
  }
];

export function useSync(sourceTracks: Track[], playlists: Playlist[], albums: { name: string }[]) {
  const [volumes, setVolumes] = useState<VolumeInfo[]>(DEMO_VOLUMES);
  const [selectedVolumePath, setSelectedVolumePath] = useState<string>(DEMO_VOLUMES[0].mountPath);
  const [scope, setScope] = useState<'all' | 'playlists' | 'albums'>('all');
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
  const [selectedAlbumNames, setSelectedAlbumNames] = useState<string[]>([]);
  const [pruneStale, setPruneStale] = useState<boolean>(true);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [syncPlan, setSyncPlan] = useState<SyncPlan | null>(null);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [syncResult, setSyncResult] = useState<{ success: boolean; copied: number; deleted: number; errors: string[] } | null>(null);

  // Refresh volumes from system
  const refreshVolumes = useCallback(async () => {
    if (typeof window !== 'undefined' && window.crateBridge && window.crateBridge.isElectron) {
      try {
        const vols = await window.crateBridge.getVolumes();
        if (vols.length > 0) {
          setVolumes(vols);
          if (!selectedVolumePath || !vols.some(v => v.mountPath === selectedVolumePath)) {
            setSelectedVolumePath(vols[0].mountPath);
          }
        }
      } catch (err) {
        console.error('Failed to get volumes:', err);
      }
    }
  }, [selectedVolumePath]);

  useEffect(() => {
    refreshVolumes();
  }, [refreshVolumes]);

  // Run delta analysis
  const runAnalysis = useCallback(async () => {
    if (!selectedVolumePath) return;

    setIsAnalyzing(true);
    setSyncResult(null);

    const activePlaylists = playlists.filter(p => selectedPlaylistIds.includes(p.id));

    if (typeof window !== 'undefined' && window.crateBridge && window.crateBridge.isElectron) {
      try {
        const plan = await window.crateBridge.analyzeSync({
          sourceTracks,
          targetVolumePath: selectedVolumePath,
          scope,
          selectedPlaylists: activePlaylists,
          selectedAlbums: selectedAlbumNames,
        });
        setSyncPlan(plan);
      } catch (err) {
        console.error('Sync analysis failed:', err);
      } finally {
        setIsAnalyzing(false);
      }
    } else {
      // Browser / Demo mode calculation
      let filtered = sourceTracks.filter(t => !t.isCorrupt);
      if (scope === 'albums' && selectedAlbumNames.length > 0) {
        const set = new Set(selectedAlbumNames.map(a => a.toLowerCase()));
        filtered = filtered.filter(t => t.album && set.has(t.album.toLowerCase()));
      } else if (scope === 'playlists' && activePlaylists.length > 0) {
        const idSet = new Set<string>();
        for (const pl of activePlaylists) {
          for (const tid of pl.trackIds) idSet.add(tid);
        }
        filtered = filtered.filter(t => idSet.has(t.id) || idSet.has(t.filePath));
      }
      
      const items = filtered.map(track => ({
        track,
        action: 'add' as const,
        targetRelativePath: `${track.artist}/${track.album}/${track.trackNumber || 1} ${track.title}.${track.format}`,
        sourceSize: track.fileSize,
        sourceMtime: track.mtime,
      }));

      const plan: SyncPlan = {
        items,
        staleFiles: ['Old Artist/Old Album/01 Old Song.mp3'],
        totalBytesToTransfer: items.reduce((acc, i) => acc + i.sourceSize, 0),
        totalFilesToTransfer: items.length,
      };

      setSyncPlan(plan);
      setIsAnalyzing(false);
    }
  }, [selectedVolumePath, sourceTracks, scope, selectedPlaylistIds, selectedAlbumNames, playlists]);

  // Execute sync
  const executeSync = useCallback(async () => {
    if (!syncPlan || !selectedVolumePath) return;

    setIsSyncing(true);
    setProgress({
      filesDone: 0,
      totalFiles: syncPlan.totalFilesToTransfer,
      bytesDone: 0,
      totalBytes: syncPlan.totalBytesToTransfer,
      currentFile: 'Preparing...',
    });

    if (typeof window !== 'undefined' && window.crateBridge && window.crateBridge.isElectron) {
      try {
        const res = await window.crateBridge.executeSync({
          plan: syncPlan,
          targetVolumePath: selectedVolumePath,
          pruneStale,
        });
        setSyncResult(res);
      } catch (err: any) {
        setSyncResult({
          success: false,
          copied: 0,
          deleted: 0,
          errors: [err.message || 'Sync failed'],
        });
      } finally {
        setIsSyncing(false);
      }
    } else {
      // Simulated browser sync
      for (let i = 1; i <= syncPlan.totalFilesToTransfer; i++) {
        await new Promise(r => setTimeout(r, 150));
        const item = syncPlan.items[i - 1];
        setProgress({
          filesDone: i,
          totalFiles: syncPlan.totalFilesToTransfer,
          bytesDone: Math.round((i / syncPlan.totalFilesToTransfer) * syncPlan.totalBytesToTransfer),
          totalBytes: syncPlan.totalBytesToTransfer,
          currentFile: item ? item.targetRelativePath : '',
        });
      }

      setSyncResult({
        success: true,
        copied: syncPlan.totalFilesToTransfer,
        deleted: pruneStale ? syncPlan.staleFiles.length : 0,
        errors: [],
      });
      setIsSyncing(false);
    }
  }, [syncPlan, selectedVolumePath, pruneStale]);

  const togglePlaylistSelection = useCallback((id: string) => {
    setSelectedPlaylistIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const toggleAlbumSelection = useCallback((name: string) => {
    setSelectedAlbumNames(prev =>
      prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
    );
  }, []);

  return {
    volumes,
    selectedVolumePath,
    setSelectedVolumePath,
    scope,
    setScope,
    selectedPlaylistIds,
    togglePlaylistSelection,
    selectedAlbumNames,
    toggleAlbumSelection,
    pruneStale,
    setPruneStale,
    isAnalyzing,
    syncPlan,
    runAnalysis,
    isSyncing,
    progress,
    syncResult,
    executeSync,
    refreshVolumes,
  };
}
