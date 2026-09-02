import { describe, it, expect, vi } from 'vitest';
import { Track, ArtistGroup, AlbumGroup } from '../src/models/types';
import {
  setDragData,
  hasDragData,
  getDragData,
  CRATE_DRAG_MIME,
  CrateDragData,
} from '../src/utils/drag-utils';

const SAMPLE_TRACK_1: Track = {
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

const SAMPLE_TRACK_2: Track = {
  id: 'trk-2',
  filePath: 'C:/Music/Pink Floyd/The Wall/02 The Thin Ice.mp3',
  title: 'The Thin Ice',
  artist: 'Pink Floyd',
  album: 'The Wall',
  albumArtist: 'Pink Floyd',
  trackNumber: 2,
  year: 1979,
  genre: 'Progressive Rock',
  duration: 147,
  format: 'mp3',
  fileSize: 4000000,
  mtime: 1600000000000,
};

const SAMPLE_ALBUM: AlbumGroup = {
  albumName: 'The Wall',
  artistName: 'Pink Floyd',
  year: 1979,
  genre: 'Progressive Rock',
  trackCount: 2,
  totalDuration: 343,
  tracks: [SAMPLE_TRACK_1, SAMPLE_TRACK_2],
};

const SAMPLE_ARTIST: ArtistGroup = {
  artistName: 'Pink Floyd',
  albumCount: 1,
  trackCount: 2,
  totalDuration: 343,
  artworks: [],
  albums: [SAMPLE_ALBUM],
  tracks: [SAMPLE_TRACK_1, SAMPLE_TRACK_2],
};

function createMockDragEvent() {
  const store: Record<string, string> = {};
  const types: string[] = [];

  const dataTransfer = {
    setData: vi.fn((format: string, data: string) => {
      store[format] = data;
      if (!types.includes(format)) types.push(format);
    }),
    getData: vi.fn((format: string) => store[format] || ''),
    types,
    effectAllowed: 'uninitialized' as string,
    dropEffect: 'none' as string,
  };

  return {
    dataTransfer,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.DragEvent;
}

describe('Drag and Drop Utilities for Library Items', () => {
  it('serializes and deserializes a single track drag payload', () => {
    const event = createMockDragEvent();
    const payload: CrateDragData = {
      type: 'track',
      trackIds: [SAMPLE_TRACK_1.id],
      tracks: [SAMPLE_TRACK_1],
      title: SAMPLE_TRACK_1.title,
      subtitle: `${SAMPLE_TRACK_1.artist} — ${SAMPLE_TRACK_1.album}`,
    };

    setDragData(event, payload);

    expect(event.dataTransfer.setData).toHaveBeenCalledWith(
      CRATE_DRAG_MIME,
      expect.any(String)
    );
    expect(event.dataTransfer.setData).toHaveBeenCalledWith(
      'application/json',
      expect.any(String)
    );
    expect(event.dataTransfer.setData).toHaveBeenCalledWith(
      'text/plain',
      'In the Flesh? (1 track)'
    );
    expect(hasDragData(event)).toBe(true);

    const recovered = getDragData(event);
    expect(recovered).not.toBeNull();
    expect(recovered?.type).toBe('track');
    expect(recovered?.trackIds).toEqual(['trk-1']);
    expect(recovered?.tracks[0].title).toBe('In the Flesh?');
  });

  it('serializes and deserializes multiple selected tracks drag payload', () => {
    const event = createMockDragEvent();
    const payload: CrateDragData = {
      type: 'tracks',
      trackIds: [SAMPLE_TRACK_1.id, SAMPLE_TRACK_2.id],
      tracks: [SAMPLE_TRACK_1, SAMPLE_TRACK_2],
      title: '2 Selected Tracks',
    };

    setDragData(event, payload);

    expect(hasDragData(event)).toBe(true);
    const recovered = getDragData(event);
    expect(recovered).not.toBeNull();
    expect(recovered?.type).toBe('tracks');
    expect(recovered?.trackIds.length).toBe(2);
    expect(recovered?.tracks.length).toBe(2);
  });

  it('serializes and deserializes an album drag payload', () => {
    const event = createMockDragEvent();
    const payload: CrateDragData = {
      type: 'album',
      trackIds: SAMPLE_ALBUM.tracks.map((t) => t.id),
      tracks: SAMPLE_ALBUM.tracks,
      title: SAMPLE_ALBUM.albumName,
      subtitle: SAMPLE_ALBUM.artistName,
    };

    setDragData(event, payload);

    expect(hasDragData(event)).toBe(true);
    const recovered = getDragData(event);
    expect(recovered).not.toBeNull();
    expect(recovered?.type).toBe('album');
    expect(recovered?.trackIds).toEqual(['trk-1', 'trk-2']);
    expect(recovered?.tracks.length).toBe(2);
  });

  it('serializes and deserializes an artist drag payload', () => {
    const event = createMockDragEvent();
    const payload: CrateDragData = {
      type: 'artist',
      trackIds: SAMPLE_ARTIST.tracks.map((t) => t.id),
      tracks: SAMPLE_ARTIST.tracks,
      title: SAMPLE_ARTIST.artistName,
      subtitle: `${SAMPLE_ARTIST.albumCount} albums, ${SAMPLE_ARTIST.trackCount} tracks`,
    };

    setDragData(event, payload);

    expect(hasDragData(event)).toBe(true);
    const recovered = getDragData(event);
    expect(recovered).not.toBeNull();
    expect(recovered?.type).toBe('artist');
    expect(recovered?.trackIds).toEqual(['trk-1', 'trk-2']);
  });

  it('handles invalid or empty drag data gracefully without crashing', () => {
    const emptyEvent = {
      dataTransfer: null,
    } as unknown as React.DragEvent;

    expect(hasDragData(emptyEvent)).toBe(false);
    expect(getDragData(emptyEvent)).toBeNull();

    const invalidEvent = createMockDragEvent();
    invalidEvent.dataTransfer.setData('application/json', 'invalid-json-content');

    expect(hasDragData(invalidEvent)).toBe(true);
    expect(getDragData(invalidEvent)).toBeNull();
  });
});
