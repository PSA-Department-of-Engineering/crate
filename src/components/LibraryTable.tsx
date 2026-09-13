import React, { useState, useMemo } from 'react';
import {
  Play,
  ArrowUp,
  ArrowDown,
  FileAudio,
  FolderOpen,
  AlertTriangle,
  Clock,
  MoreVertical,
  LayoutGrid,
  List,
} from 'lucide-react';
import { Track } from '../models/types';
import { SortField, SortDirection } from '../hooks/useLibrary';
import { ContextMenu, MenuItem } from './ContextMenu';
import {
  ContextActionHandlers,
  createSongMenuItems,
} from '../utils/menu-utils';
import { setDragData } from '../utils/drag-utils';

interface LibraryTableProps {
  tracks: Track[];
  selectedTrackIds: string[];
  currentPlayingTrackId?: string;
  isPlaying: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onSelectTrack: (trackId: string, multi: boolean) => void;
  onSelectAll: () => void;
  onPlayTrack: (track: Track) => void;
  onPlayNext?: (tracks: Track[]) => void;
  onAddToQueue?: (tracks: Track[]) => void;
  onEditTags?: (tracks: Track[]) => void;
  onAddToSync?: (scope: 'all' | 'playlists' | 'albums', names?: string[], tracks?: Track[]) => void;
  onRevealInExplorer?: (filePath: string) => void;
  onCopyPath?: (filePath: string) => void;
  onOpenFolder?: () => void;
  libraryPath?: string | null;
  searchQuery?: string;
  isEmbedded?: boolean;
  viewMode?: 'mosaic' | 'list';
  onSetViewMode?: (mode: 'mosaic' | 'list') => void;
}

export const LibraryTable: React.FC<LibraryTableProps> = ({
  tracks,
  selectedTrackIds,
  currentPlayingTrackId,
  isPlaying,
  sortField,
  sortDirection,
  onSort,
  onSelectTrack,
  onSelectAll,
  onPlayTrack,
  onPlayNext,
  onAddToQueue,
  onEditTags,
  onAddToSync,
  onRevealInExplorer,
  onCopyPath,
  onOpenFolder,
  libraryPath,
  searchQuery,
  isEmbedded,
  viewMode,
  onSetViewMode,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    title?: string;
    subtitle?: string;
    items: MenuItem[];
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    items: [],
  });

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const actionHandlers: ContextActionHandlers = useMemo(
    () => ({
      onPlay: (trks: Track[]) => {
        if (trks.length > 0) onPlayTrack(trks[0]);
      },
      onPlayNext: (trks: Track[]) => {
        if (onPlayNext) onPlayNext(trks);
      },
      onAddToQueue: (trks: Track[]) => {
        if (onAddToQueue) onAddToQueue(trks);
      },
      onEditTags: (trks: Track[]) => {
        if (onEditTags) onEditTags(trks);
      },
      onAddToSync,
      onRevealInExplorer,
      onCopyPath,
    }),
    [
      onPlayTrack,
      onPlayNext,
      onAddToQueue,
      onEditTags,
      onAddToSync,
      onRevealInExplorer,
      onCopyPath,
    ]
  );

  const openSongMenu = (e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    e.stopPropagation();
    const selectedTracks = tracks.filter((t) => selectedTrackIds.includes(t.id));
    const items = createSongMenuItems(track, actionHandlers, selectedTracks);
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      title: track.title,
      subtitle: `${track.artist} — ${track.album}`,
      items,
    });
  };

  const handleDragStart = (e: React.DragEvent, track: Track) => {
    const isMultiSelected = selectedTrackIds.includes(track.id) && selectedTrackIds.length > 1;
    const draggedTracks = isMultiSelected
      ? tracks.filter((t) => selectedTrackIds.includes(t.id))
      : [track];

    setDragData(e, {
      type: isMultiSelected ? 'tracks' : 'track',
      trackIds: draggedTracks.map((t) => t.id),
      tracks: draggedTracks,
      title: isMultiSelected ? `${draggedTracks.length} Selected Tracks` : track.title,
      subtitle: isMultiSelected ? undefined : `${track.artist} — ${track.album}`,
    });
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 inline ml-1 text-primary" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 inline ml-1 text-primary" />
    );
  };

  return (
    <div className={`flex flex-col flex-1 overflow-hidden relative ${isEmbedded ? '' : 'bg-card border border-border rounded-xl shadow-sm m-4'}`}>
      {/* Table Action / Summary Header (Unified Single Bar) */}
      <div className="px-6 py-2.5 bg-card/50 border-b border-border flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-primary">Tracks</span>
          {selectedTrackIds.length > 0 && (
            <span className="ml-2 font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
              {selectedTrackIds.length} selected
            </span>
          )}
          <button
            onClick={onSelectAll}
            className="text-muted-foreground hover:text-foreground underline decoration-dotted ml-2 text-xs"
          >
            Select All
          </button>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-muted-foreground">
            <span>
              Showing <strong className="text-foreground">{tracks.length}</strong> tracks
            </span>
          </div>

          {onSetViewMode && (
            <div className="flex items-center bg-secondary/80 p-0.5 rounded-lg border border-border/80">
              <button
                onClick={() => onSetViewMode('mosaic')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  viewMode === 'mosaic'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Mosaic View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Mosaic</span>
              </button>
              <button
                onClick={() => onSetViewMode('list')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Tracks Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm z-10 border-b border-border text-xs uppercase tracking-wider font-semibold text-muted-foreground select-none">
            <tr>
              <th className="w-10 px-3 py-2.5 text-center">#</th>
              <th
                onClick={() => onSort('trackNumber')}
                className="w-12 px-2 py-2.5 cursor-pointer hover:text-foreground text-center"
              >
                Trk {renderSortIndicator('trackNumber')}
              </th>
              <th
                onClick={() => onSort('title')}
                className="px-4 py-2.5 cursor-pointer hover:text-foreground"
              >
                Title {renderSortIndicator('title')}
              </th>
              <th
                onClick={() => onSort('artist')}
                className="px-4 py-2.5 cursor-pointer hover:text-foreground"
              >
                Artist {renderSortIndicator('artist')}
              </th>
              <th
                onClick={() => onSort('album')}
                className="px-4 py-2.5 cursor-pointer hover:text-foreground"
              >
                Album {renderSortIndicator('album')}
              </th>
              <th
                onClick={() => onSort('year')}
                className="w-16 px-3 py-2.5 cursor-pointer hover:text-foreground text-center"
              >
                Year {renderSortIndicator('year')}
              </th>
              <th
                onClick={() => onSort('genre')}
                className="px-3 py-2.5 cursor-pointer hover:text-foreground"
              >
                Genre {renderSortIndicator('genre')}
              </th>
              <th className="w-16 px-3 py-2.5 text-center">Fmt</th>
              <th
                onClick={() => onSort('duration')}
                className="w-20 px-4 py-2.5 cursor-pointer hover:text-foreground text-right"
              >
                <Clock className="w-3.5 h-3.5 inline mr-1" />
                {renderSortIndicator('duration')}
              </th>
              <th className="w-10 px-2 py-2.5 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {tracks.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16 text-center text-muted-foreground">
                  {!libraryPath ? (
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                      <div className="p-3.5 bg-primary/10 rounded-2xl text-primary">
                        <FolderOpen className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-foreground">No Music Folder Selected</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Open a local directory containing your MP3 or FLAC audio files to scan your collection and manage tags.
                        </p>
                      </div>
                      {onOpenFolder && (
                        <button
                          onClick={onOpenFolder}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg shadow-sm transition-colors mt-2"
                        >
                          <FolderOpen className="w-4 h-4" />
                          <span>Open Music Folder</span>
                        </button>
                      )}
                    </div>
                  ) : searchQuery ? (
                    <div className="flex flex-col items-center justify-center space-y-2 py-4">
                      <FileAudio className="w-8 h-8 opacity-40 text-primary" />
                      <p className="text-xs">
                        No audio tracks found matching &ldquo;<strong className="text-foreground">{searchQuery}</strong>&rdquo;
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-2 py-4">
                      <FileAudio className="w-8 h-8 opacity-40 text-primary" />
                      <p className="text-xs">No MP3 or FLAC audio tracks found in the selected folder.</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              tracks.map((track, idx) => {
                const isSelected = selectedTrackIds.includes(track.id);
                const isCurrentlyPlaying = currentPlayingTrackId === track.id;

                return (
                  <tr
                    key={track.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, track)}
                    onClick={(e) => onSelectTrack(track.id, e.ctrlKey || e.metaKey || e.shiftKey)}
                    onDoubleClick={() => onPlayTrack(track)}
                    onContextMenu={(e) => openSongMenu(e, track)}
                    className={`group cursor-pointer select-none transition-colors ${
                      isSelected
                        ? 'bg-primary/15 hover:bg-primary/20 text-foreground font-medium'
                        : isCurrentlyPlaying
                        ? 'bg-accent/40 text-accent-foreground font-medium'
                        : 'hover:bg-muted/50 text-foreground/90'
                    }`}
                  >
                    {/* Index / Play action */}
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                      {isCurrentlyPlaying ? (
                        <span className="text-primary font-bold animate-pulse">▶</span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlayTrack(track);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-primary hover:scale-110"
                        >
                          <Play className="w-3.5 h-3.5 fill-primary" />
                        </button>
                      )}
                    </td>

                    {/* Track Number */}
                    <td
                      className={`px-2 py-2 text-center text-xs font-mono ${
                        track.trackNumber
                          ? 'text-muted-foreground'
                          : 'text-destructive font-semibold'
                      }`}
                      title={track.trackNumber ? undefined : 'Missing track number in metadata (inferred from list position)'}
                    >
                      {track.trackNumber || idx + 1}
                    </td>

                    {/* Title */}
                    <td className="px-4 py-2 font-medium">
                      <div className="flex items-center gap-2">
                        {track.isCorrupt && (
                          <span title="Corrupt or unreadable metadata">
                            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                          </span>
                        )}
                        <span className="truncate">{track.title}</span>
                      </div>
                    </td>

                    {/* Artist */}
                    <td className="px-4 py-2 text-muted-foreground truncate">
                      {track.artist}
                    </td>

                    {/* Album */}
                    <td className="px-4 py-2 text-muted-foreground truncate">
                      {track.album}
                    </td>

                    {/* Year */}
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground font-mono">
                      {track.year || '—'}
                    </td>

                    {/* Genre */}
                    <td className="px-3 py-2 text-xs text-muted-foreground truncate">
                      {track.genre || '—'}
                    </td>

                    {/* Format / Bitrate Badge */}
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                          track.format === 'flac'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {track.format}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-2 text-right text-xs font-mono text-muted-foreground">
                      {formatDuration(track.duration)}
                    </td>

                    {/* 3-dots Context Menu Trigger */}
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={(e) => openSongMenu(e, track)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-all"
                        title="Track options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Context Menu Popover */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={closeContextMenu}
        title={contextMenu.title}
        subtitle={contextMenu.subtitle}
        items={contextMenu.items}
      />
    </div>
  );
};
