import { describe, it, expect, vi } from 'vitest';
import { Track, ArtistGroup, AlbumGroup } from '../src/models/types';
import {
  createArtistMenuItems,
  createAlbumMenuItems,
  createSongMenuItems,
  ContextActionHandlers,
} from '../src/utils/menu-utils';

const SAMPLE_TRACK: Track = {
  id: 'trk-1',
  filePath: 'C:/Music/Pink Floyd/The Wall/01 In the Flesh.mp3',
  title: 'In the Flesh?',
  artist: 'Pink Floyd',
  album: 'The Wall',
  albumArtist: 'Pink Floyd',
  trackNumber: 1,
  year: 1979,
  genre: 'Progressive Rock',
  duration: 196,
  format: 'mp3',
  fileSize: 5000000,
  mtime: 1600000000000,
};

const SAMPLE_ALBUM: AlbumGroup = {
  albumName: 'The Wall',
  artistName: 'Pink Floyd',
  year: 1979,
  genre: 'Progressive Rock',
  trackCount: 1,
  totalDuration: 196,
  tracks: [SAMPLE_TRACK],
};

const SAMPLE_ARTIST: ArtistGroup = {
  artistName: 'Pink Floyd',
  albumCount: 1,
  trackCount: 1,
  totalDuration: 196,
  artworks: [],
  albums: [SAMPLE_ALBUM],
  tracks: [SAMPLE_TRACK],
};

describe('Responsive Context Menu Item Generators', () => {
  it('generates responsive action items for Artist selection', () => {
    const handlers: ContextActionHandlers = {
      onPlay: vi.fn(),
      onShuffle: vi.fn(),
      onPlayNext: vi.fn(),
      onAddToQueue: vi.fn(),
      onEditTags: vi.fn(),
      onAddToSync: vi.fn(),
      onRevealInExplorer: vi.fn(),
    };

    const items = createArtistMenuItems(SAMPLE_ARTIST, handlers);
    expect(items.length).toBeGreaterThanOrEqual(6);

    const playItem = items.find((i) => i.id === 'play-artist');
    expect(playItem).toBeDefined();
    playItem?.onClick();
    expect(handlers.onPlay).toHaveBeenCalledWith(SAMPLE_ARTIST.tracks);

    const queueItem = items.find((i) => i.id === 'add-queue-artist');
    expect(queueItem).toBeDefined();
    queueItem?.onClick();
    expect(handlers.onAddToQueue).toHaveBeenCalledWith(SAMPLE_ARTIST.tracks);

    const editItem = items.find((i) => i.id === 'edit-artist-tags');
    expect(editItem).toBeDefined();
    editItem?.onClick();
    expect(handlers.onEditTags).toHaveBeenCalledWith(SAMPLE_ARTIST.tracks);

    const syncItem = items.find((i) => i.id === 'sync-artist');
    expect(syncItem).toBeDefined();
    syncItem?.onClick();
    expect(handlers.onAddToSync).toHaveBeenCalledWith('albums', ['The Wall'], SAMPLE_ARTIST.tracks);
  });

  it('generates responsive action items for Album selection', () => {
    const handlers: ContextActionHandlers = {
      onPlay: vi.fn(),
      onShuffle: vi.fn(),
      onPlayNext: vi.fn(),
      onAddToQueue: vi.fn(),
      onEditTags: vi.fn(),
      onAddToSync: vi.fn(),
      onExportPlaylist: vi.fn(),
      onRevealInExplorer: vi.fn(),
    };

    const items = createAlbumMenuItems(SAMPLE_ALBUM, handlers);
    expect(items.length).toBeGreaterThanOrEqual(7);

    const playAlbum = items.find((i) => i.id === 'play-album');
    expect(playAlbum).toBeDefined();
    playAlbum?.onClick();
    expect(handlers.onPlay).toHaveBeenCalledWith(SAMPLE_ALBUM.tracks);

    const exportItem = items.find((i) => i.id === 'export-album-m3u');
    expect(exportItem).toBeDefined();
    exportItem?.onClick();
    expect(handlers.onExportPlaylist).toHaveBeenCalledWith('The Wall', SAMPLE_ALBUM.tracks);

    const syncItem = items.find((i) => i.id === 'sync-album');
    expect(syncItem).toBeDefined();
    syncItem?.onClick();
    expect(handlers.onAddToSync).toHaveBeenCalledWith('albums', ['The Wall'], SAMPLE_ALBUM.tracks);
  });

  it('generates responsive action items for Song / Track selection', () => {
    const handlers: ContextActionHandlers = {
      onPlay: vi.fn(),
      onPlayNext: vi.fn(),
      onAddToQueue: vi.fn(),
      onEditTags: vi.fn(),
      onCopyPath: vi.fn(),
      onRevealInExplorer: vi.fn(),
    };

    const items = createSongMenuItems(SAMPLE_TRACK, handlers);
    expect(items.length).toBeGreaterThanOrEqual(6);

    const playSong = items.find((i) => i.id === 'play-song');
    expect(playSong).toBeDefined();
    playSong?.onClick();
    expect(handlers.onPlay).toHaveBeenCalledWith([SAMPLE_TRACK]);

    const playNextSong = items.find((i) => i.id === 'play-next-song');
    expect(playNextSong).toBeDefined();
    playNextSong?.onClick();
    expect(handlers.onPlayNext).toHaveBeenCalledWith([SAMPLE_TRACK]);

    const copyPath = items.find((i) => i.id === 'copy-song-path');
    expect(copyPath).toBeDefined();
    copyPath?.onClick();
    expect(handlers.onCopyPath).toHaveBeenCalledWith(SAMPLE_TRACK.filePath);

    const revealSong = items.find((i) => i.id === 'reveal-song');
    expect(revealSong).toBeDefined();
    revealSong?.onClick();
    expect(handlers.onRevealInExplorer).toHaveBeenCalledWith(SAMPLE_TRACK.filePath);
  });
});
