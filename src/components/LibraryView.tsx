import React, { useState, useEffect } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { Track, EmbeddedArtwork } from '../models/types';
import { SortField, SortDirection } from '../hooks/useLibrary';
import { LibraryMosaic } from './LibraryMosaic';
import { LibraryTable } from './LibraryTable';

export type LibraryViewMode = 'mosaic' | 'list';

interface LibraryViewProps {
  isActive?: boolean;
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
  onChangeCover?: (
    tracks: Track[],
    scope: 'artist' | 'album',
    name: string,
    currentArtwork?: Track['picture']
  ) => void;
  onResetArtistCover?: (artistName: string) => void;
  customArtistArtworks?: Record<string, EmbeddedArtwork>;
  onAddToSync?: (scope: 'all' | 'playlists' | 'albums', names?: string[], tracks?: Track[]) => void;
  onExportPlaylist?: (name: string, tracks: Track[]) => void;
  onRevealInExplorer?: (filePath: string) => void;
  onCopyPath?: (filePath: string) => void;
  onOpenFolder?: () => void;
  libraryPath?: string | null;
  searchQuery?: string;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  isActive = true,
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
  onChangeCover,
  onResetArtistCover,
  customArtistArtworks,
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
    <div className={`${isActive ? 'flex' : 'hidden'} flex-col flex-1 overflow-hidden bg-card border border-border rounded-xl shadow-sm m-4`}>
      {/* Main Content Area with Unified Single Header Bar */}
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
            onChangeCover={onChangeCover}
            onResetArtistCover={onResetArtistCover}
            customArtistArtworks={customArtistArtworks}
            onAddToSync={onAddToSync}
            onExportPlaylist={onExportPlaylist}
            onRevealInExplorer={onRevealInExplorer}
            onCopyPath={onCopyPath}
            onOpenFolder={onOpenFolder}
            libraryPath={libraryPath}
            searchQuery={searchQuery}
            viewMode={viewMode}
            onSetViewMode={handleSetViewMode}
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
              viewMode={viewMode}
              onSetViewMode={handleSetViewMode}
            />
          </div>
        )}
      </div>
    </div>
  );
};
