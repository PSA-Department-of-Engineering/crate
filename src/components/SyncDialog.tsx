import React from 'react';
import {
  Car,
  HardDrive,
  RefreshCw,
  FolderSync,
  Trash2,
  CheckCircle,
  AlertTriangle,
  FileMusic,
  ListPlus,
  Disc,
} from 'lucide-react';
import { VolumeInfo, SyncPlan, SyncProgress, Playlist, Track } from '../models/types';

interface SyncDialogProps {
  volumes: VolumeInfo[];
  selectedVolumePath: string;
  onSelectVolume: (path: string) => void;
  onRefreshVolumes: () => void;
  scope: 'all' | 'playlists' | 'albums';
  onSetScope: (scope: 'all' | 'playlists' | 'albums') => void;
  playlists: Playlist[];
  selectedPlaylistIds: string[];
  onTogglePlaylist: (id: string) => void;
  albums: { name: string; artist: string; trackCount: number }[];
  selectedAlbumNames: string[];
  onToggleAlbum: (name: string) => void;
  pruneStale: boolean;
  onSetPruneStale: (prune: boolean) => void;
  isAnalyzing: boolean;
  syncPlan: SyncPlan | null;
  onAnalyze: () => void;
  isSyncing: boolean;
  progress: SyncProgress | null;
  syncResult: { success: boolean; copied: number; deleted: number; errors: string[] } | null;
  onExecuteSync: () => void;
}

export const SyncDialog: React.FC<SyncDialogProps> = ({
  volumes,
  selectedVolumePath,
  onSelectVolume,
  onRefreshVolumes,
  scope,
  onSetScope,
  playlists,
  selectedPlaylistIds,
  onTogglePlaylist,
  albums,
  selectedAlbumNames,
  onToggleAlbum,
  pruneStale,
  onSetPruneStale,
  isAnalyzing,
  syncPlan,
  onAnalyze,
  isSyncing,
  progress,
  syncResult,
  onExecuteSync,
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const selectedVolume = volumes.find(v => v.mountPath === selectedVolumePath) || volumes[0];

  return (
    <div className="flex-1 overflow-auto bg-card border border-border rounded-xl shadow-sm m-4 p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <Car className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Car Sync & USB Media Preparation</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Formats files into <code className="bg-secondary px-1 py-0.5 rounded font-mono text-[11px]">&lt;Artist&gt;/&lt;Album&gt;/&lt;Track#&gt; &lt;Title&gt;</code> and generates relative M3U playlists with CRLF endings.
            </p>
          </div>
        </div>

        <button
          onClick={onRefreshVolumes}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold rounded-lg border border-border transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Drives</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Drive Selection & Scope */}
        <div className="flex flex-col gap-5 bg-muted/20 p-5 rounded-xl border border-border">
          {/* Drive Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Target Storage Volume
            </label>
            {volumes.length === 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                No removable USB/SD storage detected. Insert a flash drive and click Refresh.
              </div>
            ) : (
              <div className="space-y-2">
                {volumes.map(vol => (
                  <div
                    key={vol.mountPath}
                    onClick={() => onSelectVolume(vol.mountPath)}
                    className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-colors ${
                      selectedVolumePath === vol.mountPath
                        ? 'bg-primary/15 border-primary text-foreground font-semibold'
                        : 'bg-card border-border hover:bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <HardDrive className={`w-4 h-4 ${selectedVolumePath === vol.mountPath ? 'text-primary' : ''}`} />
                      <div>
                        <div className="text-xs font-bold">{vol.label} ({vol.driveLetter})</div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatBytes(vol.freeSpace)} free of {formatBytes(vol.totalSpace)}
                        </div>
                      </div>
                    </div>
                    {vol.isRemovable && (
                      <span className="text-[9px] uppercase px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded font-mono font-bold">
                        Removable
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scope Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Synchronization Scope
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-secondary p-1 rounded-lg">
              <button
                onClick={() => onSetScope('all')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  scope === 'all'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Library
              </button>
              <button
                onClick={() => onSetScope('playlists')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  scope === 'playlists'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Playlists
              </button>
              <button
                onClick={() => onSetScope('albums')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  scope === 'albums'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Albums
              </button>
            </div>
          </div>

          {/* Scope Pickers */}
          {scope === 'playlists' && (
            <div className="flex-1 flex flex-col min-h-[140px]">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Select Playlists to Sync:
              </label>
              <div className="flex-1 overflow-y-auto max-h-40 border border-border rounded-lg p-2 space-y-1 bg-card">
                {playlists.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    No playlists available.
                  </div>
                ) : (
                  playlists.map(pl => (
                    <label key={pl.id} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPlaylistIds.includes(pl.id)}
                        onChange={() => onTogglePlaylist(pl.id)}
                        className="accent-primary"
                      />
                      <span className="font-medium text-foreground">{pl.name}</span>
                      <span className="text-muted-foreground text-[10px] ml-auto">
                        ({pl.trackIds.length} tracks)
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {scope === 'albums' && (
            <div className="flex-1 flex flex-col min-h-[140px]">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Select Albums to Sync:
              </label>
              <div className="flex-1 overflow-y-auto max-h-40 border border-border rounded-lg p-2 space-y-1 bg-card">
                {albums.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    No albums in library.
                  </div>
                ) : (
                  albums.map(alb => (
                    <label key={alb.name} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAlbumNames.includes(alb.name)}
                        onChange={() => onToggleAlbum(alb.name)}
                        className="accent-primary"
                      />
                      <div className="truncate">
                        <span className="font-medium text-foreground block truncate">{alb.name}</span>
                        <span className="text-[10px] text-muted-foreground">{alb.artist}</span>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Prune Stale Toggle */}
          <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer pt-2 border-t border-border">
            <input
              type="checkbox"
              checked={pruneStale}
              onChange={e => onSetPruneStale(e.target.checked)}
              className="accent-primary"
            />
            <span>Delete stale tracks on USB not in sync scope</span>
          </label>

          {/* Analyze Button */}
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing || isSyncing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground font-semibold rounded-lg border border-border transition-colors disabled:opacity-50 text-sm"
          >
            <FolderSync className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Analyzing Drive...' : 'Analyze Delta Changes'}</span>
          </button>
        </div>

        {/* Right 2 Columns: Delta Plan Preview & Execution */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {!syncPlan ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
              <FolderSync className="w-12 h-12 mb-3 opacity-40 text-primary" />
              <h3 className="text-base font-bold text-foreground">No Sync Plan Generated</h3>
              <p className="max-w-md text-xs mt-1">
                Select your target USB drive and scope on the left, then click <strong>"Analyze Delta Changes"</strong> to compute which tracks need copying or updating.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4 bg-muted/10 border border-border rounded-xl p-5">
              {/* Summary Tiles */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-card border border-border p-3 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">New Tracks</span>
                  <span className="text-lg font-bold text-emerald-600">
                    {syncPlan.items.filter(i => i.action === 'add').length}
                  </span>
                </div>
                <div className="bg-card border border-border p-3 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Updated</span>
                  <span className="text-lg font-bold text-amber-600">
                    {syncPlan.items.filter(i => i.action === 'update').length}
                  </span>
                </div>
                <div className="bg-card border border-border p-3 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Unchanged</span>
                  <span className="text-lg font-bold text-muted-foreground">
                    {syncPlan.items.filter(i => i.action === 'keep').length}
                  </span>
                </div>
                <div className="bg-card border border-border p-3 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Transfer Size</span>
                  <span className="text-lg font-bold text-foreground font-mono">
                    {formatBytes(syncPlan.totalBytesToTransfer)}
                  </span>
                </div>
              </div>

              {/* Transcode Notice — only counts tracks actually being written this run */}
              {syncPlan.items.some(i => i.needsTranscode && i.action !== 'keep') && (
                <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg flex items-center gap-2 text-xs text-sky-800 dark:text-sky-300">
                  <FileMusic className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>
                    <strong>
                      {syncPlan.items.filter(i => i.needsTranscode && i.action !== 'keep').length}
                    </strong>{' '}
                    high-bit-depth WAV {syncPlan.items.filter(i => i.needsTranscode && i.action !== 'keep').length === 1 ? 'track' : 'tracks'}{' '}
                    will be converted to 16-bit FLAC so the car can play them. Your WAV masters stay on this PC untouched.
                  </span>
                </div>
              )}

              {/* Stale Files Alert */}
              {syncPlan.staleFiles.length > 0 && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
                    <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Found <strong>{syncPlan.staleFiles.length}</strong> orphaned tracks on USB not present in sync scope.
                    </span>
                  </div>
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                    {pruneStale ? 'Will be pruned' : 'Will be kept'}
                  </span>
                </div>
              )}

              {/* Items Table / Preview */}
              <div className="flex-1 overflow-y-auto max-h-60 border border-border rounded-lg bg-card text-xs">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-secondary border-b border-border text-[11px] uppercase font-bold text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 w-16">Action</th>
                      <th className="px-3 py-2">Car Destination Path</th>
                      <th className="px-3 py-2 w-20 text-right">Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                    {syncPlan.items.slice(0, 50).map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="px-3 py-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                              item.action === 'add'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : item.action === 'update'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-secondary text-muted-foreground'
                            }`}
                          >
                            {item.action}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-foreground truncate max-w-sm">
                          {item.targetRelativePath}
                          {item.needsTranscode && (
                            <span
                              className="ml-1.5 px-1 py-0.5 rounded text-[9px] uppercase font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                              title="Converted to 16-bit FLAC on the drive; the WAV master stays on this PC"
                            >
                              →flac
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">
                          {formatBytes(item.sourceSize)}
                        </td>
                      </tr>
                    ))}
                    {syncPlan.items.length > 50 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-center text-muted-foreground text-xs">
                          ... and {syncPlan.items.length - 50} more tracks
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Progress Bar & Sync Actions */}
              {isSyncing && progress && (
                <div className="p-4 bg-card border border-border rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-foreground">Syncing to USB...</span>
                    <span className="font-mono text-primary">
                      {progress.filesDone} / {progress.totalFiles} ({formatBytes(progress.bytesDone)} / {formatBytes(progress.totalBytes)})
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{
                        width: `${progress.totalFiles > 0 ? (progress.filesDone / progress.totalFiles) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground truncate">
                    {progress.currentFile}
                  </div>
                </div>
              )}

              {/* Sync Result Notice */}
              {syncResult && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    syncResult.success
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/20'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-500/20'
                  }`}
                >
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Sync completed! Transferred {syncResult.copied} files, removed {syncResult.deleted} stale tracks. M3U playlists written to drive root.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end mt-auto pt-2">
                <button
                  onClick={onExecuteSync}
                  disabled={isSyncing || syncPlan.totalFilesToTransfer === 0 && !pruneStale}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg shadow-md transition-all disabled:opacity-50"
                >
                  <Car className="w-4 h-4" />
                  <span>{isSyncing ? 'Writing Files to USB...' : 'Start Car Sync'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
