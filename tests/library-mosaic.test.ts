import { describe, it, expect } from 'vitest';
import { intent } from './intent-helper';
import { Track } from '../src/models/types';
import {
  groupTracksByArtist,
  groupTracksByAlbum,
  formatDuration,
  formatTotalPlaytime,
  filterTracks,
} from '../src/utils/library-utils';

const TEST_TRACKS: Track[] = [
  {
    id: '1',
    filePath: 'C:/Music/Pink Floyd/The Wall/01 In the Flesh.mp3',
    title: 'In the Flesh?',
    artist: 'Pink Floyd',
    album: 'The Wall',
    albumArtist: 'Pink Floyd',
    trackNumber: 1,
    discNumber: 1,
    year: 1979,
    genre: 'Progressive Rock',
    duration: 196,
    format: 'mp3',
    fileSize: 5000000,
    mtime: 1600000000000,
    picture: { format: 'image/jpeg', data: 'data:image/jpeg;base64,wall1' },
  },
  {
    id: '2',
    filePath: 'C:/Music/Pink Floyd/The Wall/02 The Thin Ice.flac',
    title: 'The Thin Ice',
    artist: 'Pink Floyd',
    album: 'The Wall',
    albumArtist: 'Pink Floyd',
    trackNumber: 2,
    discNumber: 1,
    year: 1979,
    genre: 'Progressive Rock',
    duration: 147,
    format: 'flac',
    fileSize: 15000000,
    mtime: 1600000001000,
    picture: { format: 'image/jpeg', data: 'data:image/jpeg;base64,wall1' },
  },
  {
    id: '3',
    filePath: 'C:/Music/Pink Floyd/Dark Side of the Moon/01 Speak to Me.mp3',
    title: 'Speak to Me',
    artist: 'Pink Floyd',
    album: 'The Dark Side of the Moon',
    albumArtist: 'Pink Floyd',
    trackNumber: 1,
    year: 1973,
    genre: 'Progressive Rock',
    duration: 90,
    format: 'mp3',
    fileSize: 4000000,
    mtime: 1600000002000,
    picture: { format: 'image/jpeg', data: 'data:image/jpeg;base64,dsotm' },
  },
  {
    id: '4',
    filePath: 'C:/Music/Daft Punk/Discovery/01 One More Time.mp3',
    title: 'One More Time',
    artist: 'Daft Punk',
    album: 'Discovery',
    albumArtist: 'Daft Punk',
    trackNumber: 1,
    year: 2001,
    genre: 'Electronic',
    duration: 320,
    format: 'mp3',
    fileSize: 8000000,
    mtime: 1600000003000,
    picture: { format: 'image/jpeg', data: 'data:image/jpeg;base64,discovery' },
  },
  {
    id: '5',
    filePath: 'C:/Music/Daft Punk/Random Access Memories/01 Give Life Back to Music.flac',
    title: 'Give Life Back to Music',
    artist: 'Daft Punk',
    album: 'Random Access Memories',
    albumArtist: 'Daft Punk',
    trackNumber: 1,
    year: 2013,
    genre: 'Funk / Disco',
    duration: 274,
    format: 'flac',
    fileSize: 22000000,
    mtime: 1600000004000,
    picture: { format: 'image/jpeg', data: 'data:image/jpeg;base64,ram' },
  },
];

describe('Hierarchical Mosaic Library Utilities', () => {
  it('groups tracks into albums with correct track counts and metadata', () => {
    const albums = groupTracksByAlbum(TEST_TRACKS);
    expect(albums.length).toBe(4);

    const theWall = albums.find((a) => a.albumName === 'The Wall');
    expect(theWall).toBeDefined();
    expect(theWall?.artistName).toBe('Pink Floyd');
    expect(theWall?.trackCount).toBe(2);
    expect(theWall?.totalDuration).toBe(196 + 147);
    expect(theWall?.year).toBe(1979);
    expect(theWall?.genre).toBe('Progressive Rock');
    expect(theWall?.artwork?.data).toBe('data:image/jpeg;base64,wall1');
    expect(theWall?.tracks.length).toBe(2);
  });

  it('groups tracks into artists with album counts, track counts, and mosaic artworks', () => {
    const artists = groupTracksByArtist(TEST_TRACKS);
    expect(artists.length).toBe(2);

    const daftPunk = artists.find((a) => a.artistName === 'Daft Punk');
    expect(daftPunk).toBeDefined();
    expect(daftPunk?.albumCount).toBe(2);
    expect(daftPunk?.trackCount).toBe(2);
    expect(daftPunk?.totalDuration).toBe(320 + 274);
    expect(daftPunk?.artworks.length).toBe(2);
    expect(daftPunk?.artworks.map((a) => a.data)).toEqual([
      'data:image/jpeg;base64,discovery',
      'data:image/jpeg;base64,ram',
    ]);

    const pinkFloyd = artists.find((a) => a.artistName === 'Pink Floyd');
    expect(pinkFloyd).toBeDefined();
    expect(pinkFloyd?.albumCount).toBe(2);
    expect(pinkFloyd?.trackCount).toBe(3);
    expect(pinkFloyd?.artworks.length).toBe(2);
  });

  it('formats track duration and total playtime accurately', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(320)).toBe('5:20');

    expect(formatTotalPlaytime(0)).toBe('0m');
    expect(formatTotalPlaytime(240)).toBe('4 min');
    expect(formatTotalPlaytime(3665)).toBe('1 hr 1 min');
  });

  it('supports filtering across hierarchical groups seamlessly', () => {
    const filteredTracks = filterTracks(TEST_TRACKS, 'Pink');
    const artists = groupTracksByArtist(filteredTracks);
    expect(artists.length).toBe(1);
    expect(artists[0].artistName).toBe('Pink Floyd');
    expect(artists[0].albums.length).toBe(2);
  });
});
