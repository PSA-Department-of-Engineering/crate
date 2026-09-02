import { contextBridge, ipcRenderer } from 'electron';
import {
  Track,
  TagUpdates,
  VolumeInfo,
  SyncPlan,
  Playlist,
  PlayerState,
  CrateBridge,
  EmbeddedArtwork,
} from '../src/models/types';

const bridge: CrateBridge = {
  isElectron: true,

  selectLibraryFolder: async (): Promise<string | null> => {
    return await ipcRenderer.invoke('library:select-folder');
  },

  scanLibrary: async (folderPath: string): Promise<{ tracks: Track[]; corruptFiles: string[] }> => {
    return await ipcRenderer.invoke('library:scan', folderPath);
  },

  getCachedLibrary: async (): Promise<{ tracks: Track[]; corruptFiles: string[] }> => {
    return await ipcRenderer.invoke('library:get-cached');
  },

  getTrackArtwork: async (filePath: string): Promise<EmbeddedArtwork | null> => {
    return await ipcRenderer.invoke('metadata:get-artwork', filePath);
  },

  saveTrackTags: async (filePath: string, tags: TagUpdates): Promise<Track> => {
    return await ipcRenderer.invoke('tags:save', { filePath, tags });
  },

  batchSaveTags: async (filePaths: string[], tags: TagUpdates): Promise<Track[]> => {
    return await ipcRenderer.invoke('tags:batch-save', { filePaths, tags });
  },

  getVolumes: async (): Promise<VolumeInfo[]> => {
    return await ipcRenderer.invoke('sync:get-volumes');
  },

  analyzeSync: async (options: {
    sourceTracks: Track[];
    targetVolumePath: string;
    scope: 'all' | 'playlists' | 'albums';
    selectedPlaylists?: Playlist[];
    selectedAlbums?: string[];
  }): Promise<SyncPlan> => {
    return await ipcRenderer.invoke('sync:analyze', options);
  },

  executeSync: async (options: {
    plan: SyncPlan;
    targetVolumePath: string;
    pruneStale: boolean;
  }): Promise<{ success: boolean; copied: number; deleted: number; errors: string[] }> => {
    return await ipcRenderer.invoke('sync:execute', options);
  },

  exportPlaylist: async (options: {
    playlistName: string;
    tracks: Track[];
    targetDir: string;
    relativeRoot?: string;
  }): Promise<string> => {
    return await ipcRenderer.invoke('playlist:export', options);
  },

  undockPlayer: async (): Promise<void> => {
    await ipcRenderer.invoke('player:undock');
  },

  dockPlayer: async (): Promise<void> => {
    await ipcRenderer.invoke('player:dock');
  },

  onPlayerCommand: (callback: (cmd: { action: string; payload?: any }) => void) => {
    const subscription = (_event: any, cmd: any) => callback(cmd);
    ipcRenderer.on('player:command', subscription);
    return () => {
      ipcRenderer.removeListener('player:command', subscription);
    };
  },

  sendPlayerState: (state: Partial<PlayerState>) => {
    ipcRenderer.send('player:state-change', state);
  },

  onPlayerState: (callback: (state: Partial<PlayerState>) => void) => {
    const subscription = (_event: any, state: any) => callback(state);
    ipcRenderer.on('player:state-sync', subscription);
    return () => {
      ipcRenderer.removeListener('player:state-sync', subscription);
    };
  },

  getStoredLibraryPath: async (): Promise<string | null> => {
    return await ipcRenderer.invoke('settings:get-library-path');
  },

  setStoredLibraryPath: async (folderPath: string): Promise<void> => {
    await ipcRenderer.invoke('settings:set-library-path', folderPath);
  },

  showInFolder: async (filePath: string): Promise<void> => {
    await ipcRenderer.invoke('system:show-in-folder', filePath);
  },

  windowControl: (action: 'minimize' | 'maximize' | 'close') => {
    ipcRenderer.send('window:control', action);
  },
};

contextBridge.exposeInMainWorld('crateBridge', bridge);
