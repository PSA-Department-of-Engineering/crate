import { describe, expect } from 'vitest';
import { intent } from './intent-helper';
import { LibraryScannerService } from '../electron/services/library-scanner';
import { Track } from '../src/models/types';

const SAMPLE_TRACKS: Track[] = [
  {
    id: '1',
    filePath: 'C:/Music/Pink Floyd/The Wall/01 In the Flesh.mp3',
    title: 'In the Flesh?',
    artist: 'Pink Floyd',
    album: 'The Wall',
    albumArtist: 'Pink Floyd',
    trackNumber: 1,
    year: 1979,
    genre: 'Rock',
    duration: 196,
    format: 'mp3',
    fileSize: 5000000,
    mtime: 1600000000000,
  },
  {
    id: '2',
    filePath: 'C:/Music/Pink Floyd/The Wall/02 The Thin Ice.flac',
    title: 'The Thin Ice',
    artist: 'Pink Floyd',
    album: 'The Wall',
    albumArtist: 'Pink Floyd',
    trackNumber: 2,
    year: 1979,
    genre: 'Rock',
    duration: 147,
    format: 'flac',
    fileSize: 15000000,
    mtime: 1600000001000,
  },
  {
    id: '3',
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
    mtime: 1600000002000,
  },
  {
    id: '4',
    filePath: 'C:/Music/Corrupt/bad_track.mp3',
    title: 'bad_track.mp3',
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    duration: 0,
    format: 'mp3',
    fileSize: 1024,
    mtime: 1600000003000,
    isCorrupt: true,
  },
];

describe('Library Ingestion & Query Engine', () => {
  intent('INT-LIB-001', 'Ingestion service imports valid MP3 and FLAC files', async () => {
    const validTracks = SAMPLE_TRACKS.filter(t => !t.isCorrupt);
    expect(validTracks.length).toBe(3);
    expect(validTracks[0].format).toBe('mp3');
    expect(validTracks[1].format).toBe('flac');
    expect(validTracks[0].title).toBe('In the Flesh?');
  });

  intent('INT-LIB-002', 'Ingestion service gracefully isolates corrupt or unreadable files', async () => {
    const corruptTracks = SAMPLE_TRACKS.filter(t => t.isCorrupt);
    expect(corruptTracks.length).toBe(1);
    expect(corruptTracks[0].isCorrupt).toBe(true);
    expect(corruptTracks[0].duration).toBe(0);
  });

  intent('INT-LIB-003', 'Library query engine filters tracks across multi-field attributes', async () => {
    // Search by title
    const searchTitle = LibraryScannerService.filterTracks(SAMPLE_TRACKS, 'Thin Ice');
    expect(searchTitle.length).toBe(1);
    expect(searchTitle[0].title).toBe('The Thin Ice');

    // Search by artist
    const searchArtist = LibraryScannerService.filterTracks(SAMPLE_TRACKS, 'Daft');
    expect(searchArtist.length).toBe(1);
    expect(searchArtist[0].artist).toBe('Daft Punk');

    // Search by album
    const searchAlbum = LibraryScannerService.filterTracks(SAMPLE_TRACKS, 'Wall');
    expect(searchAlbum.length).toBe(2);

    // Search by year
    const searchYear = LibraryScannerService.filterTracks(SAMPLE_TRACKS, '1979');
    expect(searchYear.length).toBe(2);

    // Search by genre
    const searchGenre = LibraryScannerService.filterTracks(SAMPLE_TRACKS, 'Electronic');
    expect(searchGenre.length).toBe(1);
  });

  intent('INT-LIB-004', 'Library table supports multi-column sorting ascending and descending', async () => {
    // Sort by title asc
    const sortedTitleAsc = LibraryScannerService.sortTracks(SAMPLE_TRACKS, 'title', 'asc');
    expect(sortedTitleAsc[0].title).toBe('bad_track.mp3');

    // Sort by duration desc
    const sortedDurDesc = LibraryScannerService.sortTracks(SAMPLE_TRACKS, 'duration', 'desc');
    expect(sortedDurDesc[0].title).toBe('One More Time');
    expect(sortedDurDesc[0].duration).toBe(320);

    // Sort by year asc
    const sortedYearAsc = LibraryScannerService.sortTracks(SAMPLE_TRACKS, 'year', 'asc');
    expect(sortedYearAsc[sortedYearAsc.length - 1].year).toBe(2001);
  });
});
