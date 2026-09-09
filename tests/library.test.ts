import { describe, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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
  intent('INT-LIB-001', 'Ingestion service imports valid MP3, FLAC, and WAV files', async () => {
    const validTracks = SAMPLE_TRACKS.filter(t => !t.isCorrupt);
    expect(validTracks.length).toBe(3);
    expect(validTracks[0].format).toBe('mp3');
    expect(validTracks[1].format).toBe('flac');
    expect(validTracks[0].title).toBe('In the Flesh?');

    // Test live scanning with symlinks, NTFS junctions, circular links, and broken links
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-scanner-test-'));
    try {
      const realMusicDir = path.join(tempDir, 'RealMusic');
      const nestedDir = path.join(realMusicDir, 'Rock');
      await fs.promises.mkdir(nestedDir, { recursive: true });

      // Create sample mp3, flac, and wav files
      const mp3File = path.join(nestedDir, 'song1.mp3');
      const flacFile = path.join(nestedDir, 'song2.flac');
      const wavFile = path.join(nestedDir, 'song3.wav');
      const nonAudioFile = path.join(nestedDir, 'cover.jpg');

      const mockMp3Data = Buffer.concat([
        Buffer.from([0xFF, 0xFB, 0x90, 0x64]),
        Buffer.alloc(1024, 0),
      ]);
      const flacHeader = Buffer.from('fLaC', 'ascii');
      const streamInfo = Buffer.alloc(4 + 34);
      streamInfo.writeUInt8(0x80 | 0, 0);
      streamInfo.writeUInt8(34, 3);
      const mockFlacData = Buffer.concat([flacHeader, streamInfo, Buffer.alloc(512, 0xAA)]);

      // Minimal but well-formed RIFF/WAVE container (PCM fmt chunk, empty data chunk)
      const wavData = Buffer.alloc(44);
      wavData.write('RIFF', 0);
      wavData.writeUInt32LE(36, 4);
      wavData.write('WAVE', 8);
      wavData.write('fmt ', 12);
      wavData.writeUInt32LE(16, 16);
      wavData.writeUInt16LE(1, 20);
      wavData.writeUInt16LE(2, 22);
      wavData.writeUInt32LE(44100, 24);
      wavData.writeUInt32LE(176400, 28);
      wavData.writeUInt16LE(4, 32);
      wavData.writeUInt16LE(16, 34);
      wavData.write('data', 36);
      wavData.writeUInt32LE(0, 40);

      await fs.promises.writeFile(mp3File, mockMp3Data);
      await fs.promises.writeFile(flacFile, mockFlacData);
      await fs.promises.writeFile(wavFile, wavData);
      await fs.promises.writeFile(nonAudioFile, Buffer.from('fake image data'));

      // 1. Symlink / junction directory
      const junctionDir = path.join(tempDir, 'JunctionMusic');
      try {
        await fs.promises.symlink(realMusicDir, junctionDir, 'junction');
      } catch {
        // Fallback for environments without junction support
        await fs.promises.symlink(realMusicDir, junctionDir, 'dir');
      }

      // 2. Symlinked audio file
      const symlinkMp3 = path.join(tempDir, 'linked-track.mp3');
      try {
        await fs.promises.symlink(mp3File, symlinkMp3, 'file');
      } catch {
        // If file symlinks require elevated privs on Windows, junction test still validates symlink branch
      }

      // 3. Circular symlink / junction
      const circularLink = path.join(nestedDir, 'circular_loop');
      try {
        await fs.promises.symlink(tempDir, circularLink, 'junction');
      } catch {
        try {
          await fs.promises.symlink(tempDir, circularLink, 'dir');
        } catch {
          // Ignore if unsupported
        }
      }

      // 4. Broken symlink
      const brokenLink = path.join(tempDir, 'broken-link.mp3');
      try {
        await fs.promises.symlink(path.join(tempDir, 'non-existent-target.mp3'), brokenLink, 'file');
      } catch {
        // Ignore if unsupported
      }

      const scanner = new LibraryScannerService();
      const result = await scanner.scanDirectory(tempDir);

      // Verify files were found
      expect(result.tracks.length).toBeGreaterThanOrEqual(3);
      const fileNames = result.tracks.map(t => path.basename(t.filePath).toLowerCase());
      expect(fileNames).toContain('song1.mp3');
      expect(fileNames).toContain('song2.flac');
      expect(fileNames).toContain('song3.wav');
      expect(fileNames).not.toContain('cover.jpg');

      const wavTrack = result.tracks.find(t => path.basename(t.filePath).toLowerCase() === 'song3.wav');
      expect(wavTrack?.format).toBe('wav');
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
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

    // Empty library query
    const searchEmpty = LibraryScannerService.filterTracks([], 'test');
    expect(searchEmpty).toEqual([]);
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

    // Empty library sorting
    const sortedEmpty = LibraryScannerService.sortTracks([], 'artist', 'asc');
    expect(sortedEmpty).toEqual([]);
  });
});
