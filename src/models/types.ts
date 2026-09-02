export type AudioFormat = 'mp3' | 'flac';

export interface EmbeddedArtwork {
  format: string; // e.g., 'image/jpeg', 'image/png'
  data: string;   // data URI or base64
}

export interface Track {
  id: string;
  filePath: string;
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  trackNumber?: number;
  totalTracks?: number;
  discNumber?: number;
  totalDiscs?: number;
  year?: number;
  genre?: string;
  duration: number; // in seconds
  bitrate?: number; // in kbps
  sampleRate?: number; // in Hz
  format: AudioFormat;
  picture?: EmbeddedArtwork;
  fileSize: number; // in bytes
  mtime: number;    // timestamp in ms
  isCorrupt?: boolean;
}

export interface AlbumGroup {
  albumName: string;
  artistName: string;
  year?: number;
  genre?: string;
  trackCount: number;
  totalDuration: number;
  artwork?: EmbeddedArtwork;
  tracks: Track[];
}

export interface ArtistGroup {
  artistName: string;
  albumCount: number;
  trackCount: number;
  totalDuration: number;
  artworks: EmbeddedArtwork[];
  albums: AlbumGroup[];
  tracks: Track[];
}

export interface TagUpdates {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  trackNumber?: number;
  totalTracks?: number;
  discNumber?: number;
  totalDiscs?: number;
  year?: number;
  genre?: string;
  picture?: {
    format: string;
    data: string; // base64 or data URI
  } | null; // null to remove artwork
}

export interface VolumeInfo {
  driveLetter: string; // e.g. 'E:', 'F:'
  mountPath: string;   // e.g. 'E:\' or '/media/usb'
  label: string;
  totalSpace: number;  // in bytes
  freeSpace: number;   // in bytes
  isRemovable: boolean;
}

export type SyncAction = 'add' | 'update' | 'keep' | 'delete';

export interface SyncPlanItem {
  track: Track;
  action: SyncAction;
  targetRelativePath: string;
  sourceSize: number;
  sourceMtime: number;
  destSize?: number;
  destMtime?: number;
}

export interface SyncPlan {
  items: SyncPlanItem[];
  staleFiles: string[]; // Destination relative file paths not in active scope
  totalBytesToTransfer: number;
  totalFilesToTransfer: number;
}

export interface SyncProgress {
  filesDone: number;
  totalFiles: number;
  bytesDone: number;
  totalBytes: number;
  currentFile: string;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface AudioSink {
  deviceId: string;
  label: string;
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  queue: Track[];
  queueIndex: number;
  selectedSinkId: string;
  isUndocked: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CrateBridge {
  isElectron: boolean;
  selectLibraryFolder: () => Promise<string | null>;
  scanLibrary: (folderPath: string) => Promise<{ tracks: Track[]; corruptFiles: string[] }>;
  getCachedLibrary?: () => Promise<{ tracks: Track[]; corruptFiles: string[] }>;
  getTrackArtwork: (filePath: string) => Promise<EmbeddedArtwork | null>;
  saveTrackTags: (filePath: string, tags: TagUpdates) => Promise<Track>;
  batchSaveTags: (filePaths: string[], tags: TagUpdates) => Promise<Track[]>;
  getVolumes: () => Promise<VolumeInfo[]>;
  analyzeSync: (options: {
    sourceTracks: Track[];
    targetVolumePath: string;
    scope: 'all' | 'playlists' | 'albums';
    selectedPlaylists?: Playlist[];
    selectedAlbums?: string[];
  }) => Promise<SyncPlan>;
  executeSync: (options: {
    plan: SyncPlan;
    targetVolumePath: string;
    pruneStale: boolean;
  }) => Promise<{ success: boolean; copied: number; deleted: number; errors: string[] }>;
  exportPlaylist: (options: {
    playlistName: string;
    tracks: Track[];
    targetDir: string;
    relativeRoot?: string;
  }) => Promise<string>;
  undockPlayer: () => Promise<void>;
  dockPlayer: () => Promise<void>;
  onPlayerCommand: (callback: (cmd: { action: string; payload?: any }) => void) => () => void;
  sendPlayerState: (state: Partial<PlayerState>) => void;
  onPlayerState: (callback: (state: Partial<PlayerState>) => void) => () => void;
  getStoredLibraryPath: () => Promise<string | null>;
  setStoredLibraryPath: (folderPath: string) => Promise<void>;
  showInFolder?: (filePath: string) => Promise<void>;
  windowControl: (action: 'minimize' | 'maximize' | 'close') => void;
}

declare global {
  interface Window {
    crateBridge?: CrateBridge;
  }
}
