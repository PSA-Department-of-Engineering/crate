import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { LibraryMosaic } from '../src/components/LibraryMosaic';
import { Track, CustomArtistArtworks } from '../src/models/types';
import { createArtistMenuItems, ContextActionHandlers } from '../src/utils/menu-utils';
import { groupTracksByArtist } from '../src/utils/library-utils';

const TEST_TRACKS: Track[] = [
  {
    id: 't1',
    filePath: 'C:/Music/070 Shake/Modus Vivendi/01. Don\'t Break The Silence.mp3',
    title: 'Don\'t Break The Silence',
    artist: '070 Shake',
    album: 'Modus Vivendi',
    albumArtist: '070 Shake',
    trackNumber: 1,
    year: 2020,
    genre: 'Hip Hop',
    duration: 100,
    format: 'mp3',
    fileSize: 4000000,
    mtime: 1600000000000,
    picture: { format: 'image/jpeg', data: 'data:image/jpeg;base64,album_cover_art' },
  },
  {
    id: 't2',
    filePath: 'C:/Music/070 Shake/Petrichor/01. Natural Habitat.mp3',
    title: 'Natural Habitat',
    artist: '070 Shake',
    album: 'Petrichor',
    albumArtist: '070 Shake',
    trackNumber: 1,
    year: 2024,
    genre: 'Hip Hop',
    duration: 180,
    format: 'mp3',
    fileSize: 5000000,
    mtime: 1600000001000,
    picture: { format: 'image/jpeg', data: 'data:image/jpeg;base64,album_cover_art_2' },
  },
];

describe('Artist Cover Decoupling & Hook Order Safety (#98)', () => {
  it('renders LibraryMosaic with artist without custom artwork using server rendering', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(LibraryMosaic, {
        tracks: TEST_TRACKS,
        selectedTrackIds: [],
        isPlaying: false,
        onSelectTrack: vi.fn(),
        onSelectAll: vi.fn(),
        onPlayTrack: vi.fn(),
      })
    );

    expect(html).toContain('070 Shake');
  });

  it('renders LibraryMosaic with custom artist artwork without crashing', () => {
    const customArtworks: CustomArtistArtworks = {
      '070 shake': {
        format: 'image/jpeg',
        data: 'data:image/jpeg;base64,custom_artist_photo_123',
      },
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(LibraryMosaic, {
        tracks: TEST_TRACKS,
        selectedTrackIds: [],
        isPlaying: false,
        onSelectTrack: vi.fn(),
        onSelectAll: vi.fn(),
        onPlayTrack: vi.fn(),
        customArtistArtworks: customArtworks,
      })
    );

    expect(html).toContain('070 Shake');
    expect(html).toContain('data:image/jpeg;base64,custom_artist_photo_123');
  });

  it('matches custom artist artwork key even when artist name has leading/trailing whitespace', () => {
    const tracksWithWhitespace: Track[] = [
      {
        ...TEST_TRACKS[0],
        artist: '  070 Shake  ',
        albumArtist: '  070 Shake  ',
      },
    ];

    const customArtworks: CustomArtistArtworks = {
      '070 shake': {
        format: 'image/jpeg',
        data: 'data:image/jpeg;base64,custom_artist_trimmed',
      },
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(LibraryMosaic, {
        tracks: tracksWithWhitespace,
        selectedTrackIds: [],
        isPlaying: false,
        onSelectTrack: vi.fn(),
        onSelectAll: vi.fn(),
        onPlayTrack: vi.fn(),
        customArtistArtworks: customArtworks,
      })
    );

    expect(html).toContain('data:image/jpeg;base64,custom_artist_trimmed');
  });

  it('createArtistMenuItems passes customArtwork directly and never passes album cover (#98)', () => {
    const artists = groupTracksByArtist(TEST_TRACKS);
    const artist = artists[0];
    expect(artist.artworks.length).toBeGreaterThan(0); // Has album artworks

    const handlers: ContextActionHandlers = {
      onPlay: vi.fn(),
      onPlayNext: vi.fn(),
      onAddToQueue: vi.fn(),
      onEditTags: vi.fn(),
      onChangeCover: vi.fn(),
      onResetArtistCover: vi.fn(),
    };

    // Case 1: No custom artist cover set -> must pass undefined, NOT artist.artworks[0]
    const itemsWithoutCustom = createArtistMenuItems(artist, handlers, undefined);
    const changeItem = itemsWithoutCustom.find((i) => i.id === 'change-artist-cover');
    expect(changeItem).toBeDefined();
    changeItem?.onClick();
    expect(handlers.onChangeCover).toHaveBeenCalledWith(
      artist.tracks,
      'artist',
      artist.artistName,
      undefined
    );

    // Case 2: Custom artist cover set -> must pass custom artwork
    const customArt = { format: 'image/png', data: 'data:image/png;base64,my_custom_art' };
    const itemsWithCustom = createArtistMenuItems(artist, handlers, customArt);
    const changeItemWithCustom = itemsWithCustom.find((i) => i.id === 'change-artist-cover');
    changeItemWithCustom?.onClick();
    expect(handlers.onChangeCover).toHaveBeenCalledWith(
      artist.tracks,
      'artist',
      artist.artistName,
      customArt
    );
  });
});
