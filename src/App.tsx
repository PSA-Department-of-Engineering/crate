import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LibraryView } from './components/LibraryView';
import { TagEditor } from './components/TagEditor';
import { SyncDialog } from './components/SyncDialog';
import { FullPlayer } from './components/FullPlayer';
import { MiniPlayer } from './components/MiniPlayer';
import { UndockedMiniPlayer } from './components/UndockedMiniPlayer';
import { WebFallbackView } from './components/WebFallbackView';
import { OnboardingModal } from './components/OnboardingModal';
import { RulesModal } from './components/RulesModal';
import { FixModal } from './components/FixModal';
import { SettingsModal } from './components/SettingsModal';
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
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showFixModal, setShowFixModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

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

  const handlePlayFromLibrary = (track: Track, queue?: Track[]) => {
    player.playTrack(track, queue || library.filteredAndSortedTracks);
  };

  const handleEditTags = (tracksToEdit: Track[]) => {
    library.setSelectedTrackIds(tracksToEdit.map(t => t.id));
    setActiveTab('tageditor');
  };

  const handleAddToSync = (scope: 'all' | 'playlists' | 'albums', names?: string[]) => {
    if (names && names.length > 0) {
      names.forEach(name => {
        if (!sync.selectedAlbumNames.includes(name)) {
          sync.toggleAlbumSelection(name);
        }
      });
    }
    sync.setScope(scope);
    setActiveTab('sync');
  };

  const handleRevealInExplorer = (filePath: string) => {
    if (typeof window !== 'undefined' && window.crateBridge?.showInFolder) {
      window.crateBridge.showInFolder(filePath);
    }
  };

  const handleCopyPath = (filePath: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(filePath);
    }
  };

  const handleRevealLibraryFolder = () => {
    if (library.libraryPath) {
      handleRevealInExplorer(library.libraryPath);
    } else {
      library.chooseAndScanFolder();
    }
  };

  const handleRescanLibrary = () => {
    if (library.libraryPath) {
      library.scanFolder(library.libraryPath);
    } else {
      library.chooseAndScanFolder();
    }
  };

  const handleOpenFolder = () => {
    library.chooseAndScanFolder();
  };

  const handleOpenSettings = () => {
    setShowSettingsModal(true);
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
        onRevealFolder={handleRevealLibraryFolder}
        onRescan={handleRescanLibrary}
        onOpenSettings={handleOpenSettings}
        onOpenRules={() => setShowRulesModal(true)}
        onOpenFix={() => setShowFixModal(true)}
        libraryPath={library.libraryPath}
        isElectron={isElectron}
        onUndockPlayer={player.toggleUndock}
        onDropToTagEditor={handleEditTags}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'library' && (
          <LibraryView
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
            onPlayNext={player.playNext}
            onAddToQueue={player.addToQueue}
            onEditTags={handleEditTags}
            onAddToSync={handleAddToSync}
            onRevealInExplorer={handleRevealInExplorer}
            onCopyPath={handleCopyPath}
            onOpenFolder={handleOpenFolder}
            libraryPath={library.libraryPath}
            searchQuery={library.searchQuery}
          />
        )}

        {activeTab === 'tageditor' && (
          <TagEditor
            selectedTracks={selectedTracksList}
            onSaveSingle={library.updateTrackTags}
            onSaveBatch={library.batchUpdateTags}
            onDropTracks={handleEditTags}
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
          isElectron={isElectron}
        />
      )}

      {/* Rules Overview Modal */}
      <RulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
      />

      {/* Library Fix & Diff Modal */}
      <FixModal
        isOpen={showFixModal}
        onClose={() => setShowFixModal(false)}
        tracks={library.tracks}
        onRescanLibrary={async () => {
          handleRescanLibrary();
        }}
        onApplyViolation={async (violation, track) => {
          if (violation.proposedTagUpdates) {
            await library.updateTrackTags(track.filePath, violation.proposedTagUpdates);
          }
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        libraryPath={library.libraryPath}
        onChangeLibraryFolder={handleOpenFolder}
        isScanning={library.isScanning}
      />

      {/* First-Launch / Missing Library Onboarding Modal */}
      <OnboardingModal
        isOpen={library.showOnboardingModal && !library.isLoadingSettings}
        onSelectFolder={handleOpenFolder}
        isScanning={library.isScanning}
      />
    </div>
  );
};
