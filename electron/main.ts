import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import { AudioMetadataService } from './services/audio-metadata';
import { LibraryScannerService } from './services/library-scanner';
import { SyncManagerService } from './services/sync-manager';
import { PlaylistExporterService } from './services/playlist-exporter';
import { SettingsManagerService } from './services/settings-manager';
import { TagUpdates, Track, Playlist, SyncPlan } from '../src/models/types';

let mainWindow: BrowserWindow | null = null;
let playerWindow: BrowserWindow | null = null;

const metadataService = new AudioMetadataService();
const libraryScanner = new LibraryScannerService(metadataService);
const syncManager = new SyncManagerService();
const settingsManager = new SettingsManagerService();

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'Crate',
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#FAF8F5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (playerWindow) {
      playerWindow.close();
      playerWindow = null;
    }
  });
}

function createPlayerWindow() {
  if (playerWindow) {
    playerWindow.focus();
    return;
  }

  playerWindow = new BrowserWindow({
    width: 440,
    height: 240,
    resizable: false,
    alwaysOnTop: true,
    frame: false,
    title: 'Crate - Mini Player',
    backgroundColor: '#FAF8F5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const url = process.env.VITE_DEV_SERVER_URL
    ? `${process.env.VITE_DEV_SERVER_URL}#undocked-player`
    : `file://${path.join(__dirname, '../dist/index.html')}#undocked-player`;

  playerWindow.loadURL(url);

  playerWindow.on('closed', () => {
    playerWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('player:docked');
    }
  });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Window control handlers
ipcMain.on('window:control', (event, action: 'minimize' | 'maximize' | 'close') => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  if (action === 'minimize') {
    win.minimize();
  } else if (action === 'maximize') {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  } else if (action === 'close') {
    win.close();
  }
});

// Library handlers
ipcMain.handle('library:select-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Music Library Root Folder',
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('library:scan', async (_event, folderPath: string) => {
  return await libraryScanner.scanDirectory(folderPath);
});

// Artwork lazy-loading handler
ipcMain.handle('metadata:get-artwork', async (_event, filePath: string) => {
  return await metadataService.getArtwork(filePath);
});

// Settings & Config persistence handlers
ipcMain.handle('settings:get-library-path', async () => {
  return await settingsManager.getLibraryPath();
});

ipcMain.handle('settings:set-library-path', async (_event, folderPath: string) => {
  await settingsManager.setLibraryPath(folderPath);
});

ipcMain.handle('settings:get', async () => {
  return await settingsManager.getSettings();
});

ipcMain.handle('settings:save', async (_event, updates) => {
  return await settingsManager.saveSettings(updates);
});

// Tag editing handlers
ipcMain.handle('tags:save', async (_event, data: { filePath: string; tags: TagUpdates }) => {
  return await metadataService.writeTrackTags(data.filePath, data.tags);
});

ipcMain.handle('tags:batch-save', async (_event, data: { filePaths: string[]; tags: TagUpdates }) => {
  const updatedTracks: Track[] = [];
  for (const filePath of data.filePaths) {
    const updated = await metadataService.writeTrackTags(filePath, data.tags);
    updatedTracks.push(updated);
  }
  return updatedTracks;
});

// Car Sync handlers
ipcMain.handle('sync:get-volumes', async () => {
  return await syncManager.getVolumes();
});

ipcMain.handle('sync:analyze', async (_event, options: {
  sourceTracks: Track[];
  targetVolumePath: string;
  scope: 'all' | 'playlists' | 'albums';
  selectedPlaylists?: Playlist[];
  selectedAlbums?: string[];
}) => {
  return await syncManager.analyzeSync(options);
});

ipcMain.handle('sync:execute', async (_event, options: {
  plan: SyncPlan;
  targetVolumePath: string;
  pruneStale: boolean;
  selectedPlaylists?: Playlist[];
}) => {
  return await syncManager.executeSync(options);
});

// Playlist export handlers
ipcMain.handle('playlist:export', async (_event, options: {
  playlistName: string;
  tracks: Track[];
  targetDir: string;
  relativeRoot?: string;
}) => {
  return await PlaylistExporterService.exportPlaylist(options);
});

// File & System handlers
ipcMain.handle('system:show-in-folder', async (_event, filePath: string) => {
  if (filePath) {
    shell.showItemInFolder(filePath);
  }
});

// Undocked Mini Player handlers
ipcMain.handle('player:undock', async () => {
  createPlayerWindow();
});

ipcMain.handle('player:dock', async () => {
  if (playerWindow) {
    playerWindow.close();
    playerWindow = null;
  }
});

// State & command sync across main & secondary windows
ipcMain.on('player:state-change', (_event, state) => {
  if (playerWindow && !playerWindow.isDestroyed()) {
    playerWindow.webContents.send('player:state-sync', state);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('player:state-sync', state);
  }
});

ipcMain.on('player:command', (_event, cmd) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('player:command', cmd);
  }
});
