import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LibraryTable } from './components/LibraryTable';
import { TagEditor } from './components/TagEditor';
import { SyncDialog } from './components/SyncDialog';
import { FullPlayer } from './components/FullPlayer';
import { MiniPlayer } from './components/MiniPlayer';
import { UndockedMiniPlayer } from './components/UndockedMiniPlayer';
import { WebFallbackView } from './components/WebFallbackView';
import { useLibrary } from './hooks/useLibrary';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useSync } from './hooks/useSync';
import { Track } from './models/types';

export const App: React.FC = () => {
  const isUndockedWindow = typeof window !== 'undefined' && window.location.hash === '#undocked-player';
  const isElectron = typeof window !== 'undefined' && !!window.crateBridge?.isElectron;

  const [activeTab, setActiveTab] = useState<'library' | 'tageditor' | 'sync' | 'player' | 'webportal'>(
    isElectron ? 'library' : 'webportal'
  );

  const library = useLibrary();
  const player = useAudioPlayer();
  const sync = useSync(library.tracks, library.playlists, library.albums);

  // Keyboard Shortcuts (Space play/pause, Arrow Left/Right seek, Arrow Up/Down volume)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting keystrokes in input elements
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        player.togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        player.seek(Math.max(0, player.state.currentTime - 5));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        player.seek(Math.min(player.state.duration, player.state.currentTime + 5));
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        player.setVolume(Math.min(1, player.state.volume + 0.05));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        player.setVolume(Math.max(0, player.state.volume - 0.05));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [player]);

  // If this window is the standalone undocked player
  if (isUndockedWindow) {
    return <UndockedMiniPlayer />;
  }

  const selectedTracksList = library.tracks.filter(t => library.selectedTrackIds.includes(t.id));

  const handlePlayFromLibrary = (track: Track) => {
    player.playTrack(track, library.filteredAndSortedTracks);
  };

  const handleOpenFolder = () => {
    library.chooseAndScanFolder();
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Draggable Titlebar & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={library.searchQuery}
        setSearchQuery={library.setSearchQuery}
        onOpenFolder={handleOpenFolder}
        libraryPath={library.libraryPath}
        isElectron={isElectron}
        onUndockPlayer={player.toggleUndock}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'library' && (
          <LibraryTable
            tracks={library.filteredAndSortedTracks}
            selectedTrackIds={library.selectedTrackIds}
            currentPlayingTrackId={player.state.currentTrack?.id}
            isPlaying={player.state.isPlaying}
            sortField={library.sortField}
            sortDirection={library.sortDirection}
            onSort={library.handleSort}
            onSelectTrack={library.toggleSelectTrack}
            onSelectAll={library.selectAll}
            onPlayTrack={handlePlayFromLibrary}
          />
        )}

        {activeTab === 'tageditor' && (
          <TagEditor
            selectedTracks={selectedTracksList}
            onSaveSingle={library.updateTrackTags}
            onSaveBatch={library.batchUpdateTags}
          />
        )}

        {activeTab === 'sync' && (
          <SyncDialog
            volumes={sync.volumes}
            selectedVolumePath={sync.selectedVolumePath}
            onSelectVolume={sync.setSelectedVolumePath}
            onRefreshVolumes={sync.refreshVolumes}
            scope={sync.scope}
            onSetScope={sync.setScope}
            playlists={library.playlists}
            selectedPlaylistIds={sync.selectedPlaylistIds}
            onTogglePlaylist={sync.togglePlaylistSelection}
            albums={library.albums}
            selectedAlbumNames={sync.selectedAlbumNames}
            onToggleAlbum={sync.toggleAlbumSelection}
            pruneStale={sync.pruneStale}
            onSetPruneStale={sync.setPruneStale}
            isAnalyzing={sync.isAnalyzing}
            syncPlan={sync.syncPlan}
            onAnalyze={sync.runAnalysis}
            isSyncing={sync.isSyncing}
            progress={sync.progress}
            syncResult={sync.syncResult}
            onExecuteSync={sync.executeSync}
          />
        )}

        {activeTab === 'player' && (
          <FullPlayer
            state={player.state}
            availableSinks={player.availableSinks}
            onTogglePlay={player.togglePlay}
            onNext={player.handleNext}
            onPrev={player.handlePrev}
            onSeek={player.seek}
            onSetVolume={player.setVolume}
            onToggleMute={player.toggleMute}
            onToggleShuffle={player.toggleShuffle}
            onCycleRepeat={player.cycleRepeat}
            onSelectSink={player.selectSink}
            onPlayQueueItem={(trk, idx) => player.playTrack(trk, player.state.queue, idx)}
          />
        )}

        {activeTab === 'webportal' && (
          <WebFallbackView onEnterDemo={() => setActiveTab('library')} />
        )}
      </main>

      {/* Persistent Bottom Mini Player */}
      {!player.state.isUndocked && activeTab !== 'player' && (
        <MiniPlayer
          state={player.state}
          availableSinks={player.availableSinks}
          onTogglePlay={player.togglePlay}
          onNext={player.handleNext}
          onPrev={player.handlePrev}
          onSeek={player.seek}
          onSetVolume={player.setVolume}
          onToggleMute={player.toggleMute}
          onToggleShuffle={player.toggleShuffle}
          onCycleRepeat={player.cycleRepeat}
          onSelectSink={player.selectSink}
          onExpandPlayer={() => setActiveTab('player')}
          onToggleUndock={player.toggleUndock}
          isElectron={isElectron}
        />
      )}
    </div>
  );
};
