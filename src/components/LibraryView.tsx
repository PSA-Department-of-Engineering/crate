import React, { useState, useEffect } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { Track } from '../models/types';
import { SortField, SortDirection } from '../hooks/useLibrary';
import { LibraryMosaic } from './LibraryMosaic';
import { LibraryTable } from './LibraryTable';

export type LibraryViewMode = 'mosaic' | 'list';

interface LibraryViewProps {
  tracks: Track[];
  selectedTrackIds: string[];
  currentPlayingTrackId?: string;
  isPlaying: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onSelectTrack: (trackId: string, multi: boolean) => void;
  onSelectAll: () => void;
  onPlayTrack: (track: Track, queue?: Track[]) => void;
  onPlayNext?: (tracks: Track[]) => void;
  onAddToQueue?: (tracks: Track[]) => void;
  onEditTags?: (tracks: Track[]) => void;
  onAddToSync?: (scope: 'all' | 'playlists' | 'albums', names?: string[], tracks?: Track[]) => void;
  onExportPlaylist?: (name: string, tracks: Track[]) => void;
  onRevealInExplorer?: (filePath: string) => void;
  onCopyPath?: (filePath: string) => void;
  onOpenFolder?: () => void;
  libraryPath?: string | null;
  searchQuery?: string;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
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
  onExportPlaylist,
  onRevealInExplorer,
  onCopyPath,
  onOpenFolder,
  libraryPath,
  searchQuery,
}) => {
  const [viewMode, setViewMode] = useState<LibraryViewMode>('mosaic');

  // Load persisted view mode preference on mount
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const savedMode = localStorage.getItem('crate_library_view_mode') as LibraryViewMode | null;
      if (savedMode === 'mosaic' || savedMode === 'list') {
        setViewMode(savedMode);
      }
    }
  }, []);

  const handleSetViewMode = (mode: LibraryViewMode) => {
    setViewMode(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('crate_library_view_mode', mode);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-card border border-border rounded-xl shadow-sm m-4">
      {/* View Switcher Toolbar */}
      <div className="px-4 py-2 bg-muted/40 border-b border-border flex items-center justify-between text-xs text-muted-foreground select-none">
        <div className="flex items-center gap-2">
          <span>
            Library View: <strong className="text-foreground capitalize">{viewMode}</strong>
          </span>
          {selectedTrackIds.length > 0 && (
            <span className="ml-2 font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
              {selectedTrackIds.length} selected
            </span>
          )}
        </div>

        {/* Mode Toggle Buttons */}
        <div className="flex items-center bg-secondary/80 p-0.5 rounded-lg border border-border/80">
          <button
            onClick={() => handleSetViewMode('mosaic')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              viewMode === 'mosaic'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Hierarchical Mosaic Grid View (Artists -> Albums -> Songs)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Mosaic</span>
          </button>
          <button
            onClick={() => handleSetViewMode('list')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              viewMode === 'list'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Full Flat Tracks Table View"
          >
            <List className="w-3.5 h-3.5" />
            <span>List</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'mosaic' ? (
          <LibraryMosaic
            tracks={tracks}
            selectedTrackIds={selectedTrackIds}
            currentPlayingTrackId={currentPlayingTrackId}
            isPlaying={isPlaying}
            onSelectTrack={onSelectTrack}
            onSelectAll={onSelectAll}
            onPlayTrack={onPlayTrack}
            onPlayNext={onPlayNext}
            onAddToQueue={onAddToQueue}
            onEditTags={onEditTags}
            onAddToSync={onAddToSync}
            onExportPlaylist={onExportPlaylist}
            onRevealInExplorer={onRevealInExplorer}
            onCopyPath={onCopyPath}
            onOpenFolder={onOpenFolder}
            libraryPath={libraryPath}
            searchQuery={searchQuery}
          />
        ) : (
          <div className="flex-1 flex overflow-hidden">
            <LibraryTable
              tracks={tracks}
              selectedTrackIds={selectedTrackIds}
              currentPlayingTrackId={currentPlayingTrackId}
              isPlaying={isPlaying}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
              onSelectTrack={onSelectTrack}
              onSelectAll={onSelectAll}
              onPlayTrack={(trk) => onPlayTrack(trk, tracks)}
              onPlayNext={onPlayNext}
              onAddToQueue={onAddToQueue}
              onEditTags={onEditTags}
              onAddToSync={onAddToSync}
              onRevealInExplorer={onRevealInExplorer}
              onCopyPath={onCopyPath}
              onOpenFolder={onOpenFolder}
              libraryPath={libraryPath}
              searchQuery={searchQuery}
              isEmbedded
            />
          </div>
        )}
      </div>
    </div>
  );
};
