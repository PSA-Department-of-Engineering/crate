import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import { AudioMetadataService } from './services/audio-metadata';
import { LibraryScannerService } from './services/library-scanner';
import { LibraryDatabaseService } from './services/library-database';
import { SyncManagerService } from './services/sync-manager';
import { PlaylistExporterService } from './services/playlist-exporter';
import { SettingsManagerService } from './services/settings-manager';
import { AppUpdaterService, isPortableBuild } from './services/app-updater';
import { fetchArtworkFromUrl } from './services/artwork-input';
import { moveLibraryFile, validateLibraryMoveRequest } from './services/library-organizer';

import { TagUpdates, Track, Playlist, SyncPlan, UpdateStatus } from '../src/models/types';

let mainWindow: BrowserWindow | null = null;
let playerWindow: BrowserWindow | null = null;

const dbService = new LibraryDatabaseService();
const metadataService = new AudioMetadataService(path.join(app.getPath('userData'), 'artwork-cache'));
const libraryScanner = new LibraryScannerService(metadataService, dbService);
const syncManager = new SyncManagerService();
const settingsManager = new SettingsManagerService();

function appendAppLog(line: string) {
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'app.log'), `${line}
`);
  } catch {}
}

function sendUpdateStatus(status: UpdateStatus) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', status);
  }
}

const appUpdater = new AppUpdaterService({
  getUpdater: () => {
    // A packaged app's console goes nowhere; keep update diagnostics in app.log.
    autoUpdater.logger = {
      info: message => appendAppLog(`[Updater] ${message}`),
      warn: message => appendAppLog(`[Updater warn] ${message}`),
      error: message => appendAppLog(`[Updater error] ${message}`),
    };
    return autoUpdater;
  },
  isPackaged: app.isPackaged,
  isPortable: isPortableBuild(),
  onStatus: sendUpdateStatus,
  log: line => appendAppLog(`[Updater] ${line}`),
});

export function getAppIcon(): string | undefined {
  const possiblePaths = [
    path.join(__dirname, '../public/icon.ico'),
    path.join(__dirname, '../public/icon.png'),
    path.join(app.getAppPath(), 'dist/icon.ico'),
    path.join(app.getAppPath(), 'dist/icon.png'),
    path.join(app.getAppPath(), 'public/icon.ico'),
    path.join(app.getAppPath(), 'public/icon.png'),
    path.join(app.getAppPath(), 'build/icon.ico'),
    path.join(app.getAppPath(), 'build/icon.png'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return undefined;
}

export function getDistIndexPath(): string {
  const possiblePaths = [
    path.join(__dirname, '../../dist/index.html'),
    path.join(__dirname, '../dist/index.html'),
    path.join(app.getAppPath(), 'dist/index.html'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return path.join(app.getAppPath(), 'dist/index.html');
}

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
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  const appLogPath = path.join(app.getPath('userData'), 'app.log');
  // Electron 35 replaced the positional (event, level, message, line, sourceId)
  // arguments with a single details object, and `level` became a string
  // ('info' | 'warning' | 'error' | 'debug') instead of a numeric code.
  mainWindow.webContents.on('console-message', ({ level, message, lineNumber, sourceId }) => {
    try {
      fs.appendFileSync(appLogPath, `[Console ${level}] ${message} (${sourceId}:${lineNumber})\n`);
    } catch {}
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    try {
      fs.appendFileSync(appLogPath, `[Load Failed] ${errorCode} ${errorDescription} (${validatedURL})\n`);
    } catch {}
    if (process.env.VITE_DEV_SERVER_URL && validatedURL.startsWith(process.env.VITE_DEV_SERVER_URL)) {
      console.warn(`Dev server at ${validatedURL} unreachable (${errorDescription}). Loading local dist/index.html...`);
      mainWindow?.loadFile(getDistIndexPath());
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      if (mainWindow?.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow?.webContents.openDevTools({ mode: 'detach' });
      }
      event.preventDefault();
    } else if (input.control && input.key.toLowerCase() === 'r') {
      mainWindow?.webContents.reload();
      event.preventDefault();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.session.clearCache();
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL).catch(() => {
      mainWindow?.loadFile(getDistIndexPath());
    });
  } else {
    mainWindow.loadFile(getDistIndexPath());
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
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const url = process.env.VITE_DEV_SERVER_URL
    ? `${process.env.VITE_DEV_SERVER_URL}#undocked-player`
    : `file://${getDistIndexPath()}#undocked-player`;

  playerWindow.loadURL(url);

  playerWindow.on('closed', () => {
    playerWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('player:docked');
    }
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('dev.chaos-architect.crate');
  }
  createMainWindow();
  appUpdater.start();

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

ipcMain.handle('library:get-cached', async () => {
  const tracks = dbService.getAllTracks();
  const corruptFiles = tracks.filter(t => t.isCorrupt).map(t => t.filePath);
  return { tracks, corruptFiles };
});

// Artwork lazy-loading handler
ipcMain.handle('metadata:get-artwork', async (_event, filePath: string) => {
  return await metadataService.getArtwork(filePath);
});

ipcMain.handle('library:move-track', async (_event, data: unknown) => {
  const configuredLibraryRoot = await settingsManager.getLibraryPath();
  if (!configuredLibraryRoot) {
    throw new Error('No managed library root is configured.');
  }

  const request = validateLibraryMoveRequest(data, configuredLibraryRoot);
  const moved = await moveLibraryFile(request.filePath, request.destinationPath, configuredLibraryRoot);
  const updated = await metadataService.readTrack(moved.destinationPath, { skipCovers: true });

  // The scanner uses file paths as track identities. Replace the old database
  // row immediately; the caller performs a full incremental rescan after the
  // Fix batch completes to refresh every renderer reference.
  dbService.deleteTracksByPaths([moved.sourcePath]);
  dbService.upsertTrack(updated);
  return updated;
});

// Download artwork in the main process so remote images do not depend on
// browser CORS headers. The renderer performs the crop and final JPEG encode.
ipcMain.handle('artwork:fetch-url', async (_event, url: string) => {
  return await fetchArtworkFromUrl(url);
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

// Auto-update handlers (INT-DIST-003)
ipcMain.handle('updater:get-status', () => appUpdater.getStatus());

ipcMain.handle('updater:check', async () => {
  return await appUpdater.checkNow();
});

ipcMain.handle('updater:install', () => {
  appUpdater.restartToUpdate();
});

// Tag editing handlers
ipcMain.handle('tags:save', async (_event, data: { filePath: string; tags: TagUpdates }) => {
  const updated = await metadataService.writeTrackTags(data.filePath, data.tags);
  dbService.upsertTrack(updated);
  return updated;
});

ipcMain.handle('tags:batch-save', async (_event, data: { filePaths: string[]; tags: TagUpdates }) => {
  const updatedTracks: Track[] = [];
  for (const filePath of data.filePaths) {
    // Batch callers already know the artwork being applied. Avoid parsing and
    // returning the same large embedded image once per track.
    const updated = await metadataService.writeTrackTags(filePath, data.tags, { includeArtwork: false });
    updatedTracks.push(updated);
  }
  dbService.upsertTracks(updatedTracks);
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
