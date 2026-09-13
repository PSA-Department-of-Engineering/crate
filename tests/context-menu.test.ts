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
      onChangeCover: vi.fn(),
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

    const changeCoverItem = items.find((i) => i.id === 'change-artist-cover');
    expect(changeCoverItem).toBeDefined();
    changeCoverItem?.onClick();
    expect(handlers.onChangeCover).toHaveBeenCalledWith(
      SAMPLE_ARTIST.tracks,
      'artist',
      'Pink Floyd',
      undefined
    );

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
      onChangeCover: vi.fn(),
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

    const changeCoverItem = items.find((i) => i.id === 'change-album-cover');
    expect(changeCoverItem).toBeDefined();
    changeCoverItem?.onClick();
    expect(handlers.onChangeCover).toHaveBeenCalledWith(
      SAMPLE_ALBUM.tracks,
      'album',
      'The Wall',
      undefined
    );
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

  it('includes Edit All Selected action when multiple tracks are selected (#85)', () => {
    const secondTrack: Track = {
      ...SAMPLE_TRACK,
      id: 't-sample-2',
      filePath: 'C:/Music/Pink Floyd/The Wall/02 The Thin Ice.mp3',
      title: 'The Thin Ice',
      trackNumber: 2,
    };

    const handlers: ContextActionHandlers = {
      onPlay: vi.fn(),
      onPlayNext: vi.fn(),
      onAddToQueue: vi.fn(),
      onEditTags: vi.fn(),
      onCopyPath: vi.fn(),
      onRevealInExplorer: vi.fn(),
    };

    const selectedTracks = [SAMPLE_TRACK, secondTrack];
    const items = createSongMenuItems(SAMPLE_TRACK, handlers, selectedTracks);

    const editSingle = items.find((i) => i.id === 'edit-song-tags');
    expect(editSingle).toBeDefined();
    editSingle?.onClick();
    expect(handlers.onEditTags).toHaveBeenCalledWith([SAMPLE_TRACK]);

    const editAll = items.find((i) => i.id === 'edit-all-selected-tags');
    expect(editAll).toBeDefined();
    expect(editAll?.label).toBe('Edit All Selected (2 tracks)');
    editAll?.onClick();
    expect(handlers.onEditTags).toHaveBeenCalledWith(selectedTracks);
  });

  it('includes Reset Artist Cover item and passes custom artwork when artist has custom artwork', () => {
    const customArt = { format: 'image/jpeg', data: 'data:image/jpeg;base64,custom_photo' };
    const handlers: ContextActionHandlers = {
      onPlay: vi.fn(),
      onPlayNext: vi.fn(),
      onAddToQueue: vi.fn(),
      onEditTags: vi.fn(),
      onChangeCover: vi.fn(),
      onResetArtistCover: vi.fn(),
    };

    const items = createArtistMenuItems(SAMPLE_ARTIST, handlers, customArt);
    const resetItem = items.find((i) => i.id === 'reset-artist-cover');
    expect(resetItem).toBeDefined();
    expect(resetItem?.label).toBe('Reset Artist Cover');
    resetItem?.onClick();
    expect(handlers.onResetArtistCover).toHaveBeenCalledWith('Pink Floyd');

    const changeCoverItem = items.find((i) => i.id === 'change-artist-cover');
    expect(changeCoverItem).toBeDefined();
    changeCoverItem?.onClick();
    expect(handlers.onChangeCover).toHaveBeenCalledWith(
      SAMPLE_ARTIST.tracks,
      'artist',
      'Pink Floyd',
      customArt
    );
  });

  it('passes undefined (never album artwork) to onChangeCover when artist has no custom artwork (#98)', () => {
    const handlers: ContextActionHandlers = {
      onPlay: vi.fn(),
      onPlayNext: vi.fn(),
      onAddToQueue: vi.fn(),
      onEditTags: vi.fn(),
      onChangeCover: vi.fn(),
      onResetArtistCover: vi.fn(),
    };

    const albumArt = { format: 'image/jpeg', data: 'data:image/jpeg;base64,album_art' };
    const artistWithAlbumArt: ArtistGroup = {
      ...SAMPLE_ARTIST,
      artworks: [albumArt],
    };

    const items = createArtistMenuItems(artistWithAlbumArt, handlers, undefined);
    const resetItem = items.find((i) => i.id === 'reset-artist-cover');
    expect(resetItem).toBeUndefined();

    const changeCoverItem = items.find((i) => i.id === 'change-artist-cover');
    expect(changeCoverItem).toBeDefined();
    changeCoverItem?.onClick();
    // Must pass undefined for currentArtwork, NOT the album's artwork!
    expect(handlers.onChangeCover).toHaveBeenCalledWith(
      artistWithAlbumArt.tracks,
      'artist',
      'Pink Floyd',
      undefined
    );
  });
});
