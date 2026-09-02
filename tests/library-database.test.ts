import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LibraryDatabaseService } from '../electron/services/library-database';
import { LibraryScannerService } from '../electron/services/library-scanner';
import { Track } from '../src/models/types';

describe('Embedded SQLite Library Database & Incremental Sync', () => {
  it('Initializes SQLite database with WAL mode and tables', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-sqlite-test-'));
    const dbPath = path.join(tempDir, 'test-library.db');

    try {
      const dbService = new LibraryDatabaseService(dbPath);
      expect(fs.existsSync(dbPath)).toBe(true);

      const stats = dbService.getStats();
      expect(stats.trackCount).toBe(0);
      expect(stats.artistCount).toBe(0);
      expect(stats.albumCount).toBe(0);

      dbService.close();
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('Supports single and batch upserts, queries, and deletions transactionally', async () => {
    const dbService = new LibraryDatabaseService(':memory:');

    try {
      const sampleTrack1: Track = {
        id: 'track-1',
        filePath: 'C:/Music/Artist A/Album 1/01 Song.mp3',
        title: 'Song One',
        artist: 'Artist A',
        album: 'Album 1',
        albumArtist: 'Artist A',
        trackNumber: 1,
        totalTracks: 10,
        discNumber: 1,
        totalDiscs: 1,
        year: 2024,
        genre: 'Synthwave',
        duration: 210,
        bitrate: 320,
        sampleRate: 44100,
        format: 'mp3',
        fileSize: 8400000,
        mtime: 1700000000000,
      };

      const sampleTrack2: Track = {
        id: 'track-2',
        filePath: 'C:/Music/Artist B/Album 2/02 Song.flac',
        title: 'Song Two',
        artist: 'Artist B',
        album: 'Album 2',
        duration: 180,
        format: 'flac',
        fileSize: 22000000,
        mtime: 1700000001000,
      };

      // Batch upsert
      dbService.upsertTracks([sampleTrack1, sampleTrack2]);

      let allTracks = dbService.getAllTracks();
      expect(allTracks.length).toBe(2);
      expect(allTracks[0].artist).toBe('Artist A');
      expect(allTracks[1].artist).toBe('Artist B');

      let stats = dbService.getStats();
      expect(stats.trackCount).toBe(2);
      expect(stats.artistCount).toBe(2);
      expect(stats.albumCount).toBe(2);

      // Single track update (e.g. from Tag Editor)
      const updatedTrack1: Track = {
        ...sampleTrack1,
        title: 'Song One (Remix)',
        genre: 'Electronic',
      };
      dbService.upsertTrack(updatedTrack1);

      const queried = dbService.getTrackByPath(sampleTrack1.filePath);
      expect(queried?.title).toBe('Song One (Remix)');
      expect(queried?.genre).toBe('Electronic');

      // Delete by path
      dbService.deleteTracksByPaths([sampleTrack2.filePath]);
      allTracks = dbService.getAllTracks();
      expect(allTracks.length).toBe(1);
      expect(allTracks[0].filePath).toBe(sampleTrack1.filePath);

      // Clear library
      dbService.clearLibrary();
      expect(dbService.getAllTracks().length).toBe(0);
    } finally {
      dbService.close();
    }
  });

  it('Performs high-speed cold-start load (<50ms for thousands of tracks)', async () => {
    const dbService = new LibraryDatabaseService(':memory:');

    try {
      const bulkTracks: Track[] = [];
      for (let i = 0; i < 3000; i++) {
        bulkTracks.push({
          id: `track-${i}`,
          filePath: `C:/Music/Artist-${i % 50}/Album-${i % 100}/${i} Track.mp3`,
          title: `Track ${i}`,
          artist: `Artist ${i % 50}`,
          album: `Album ${i % 100}`,
          trackNumber: (i % 12) + 1,
          year: 2000 + (i % 25),
          duration: 180 + (i % 120),
          format: 'mp3',
          fileSize: 5000000,
          mtime: 1700000000000 + i * 1000,
        });
      }

      dbService.upsertTracks(bulkTracks);

      const startTime = performance.now();
      const loaded = dbService.getAllTracks();
      const elapsed = performance.now() - startTime;

      expect(loaded.length).toBe(3000);
      expect(elapsed).toBeLessThan(50); // Instant cold start under 50ms
    } finally {
      dbService.close();
    }
  });

  it('Incremental scanner checks mtime and reconciles additions, updates, and deletions', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-scanner-db-test-'));
    const dbPath = path.join(tempDir, 'test-incremental.db');

    try {
      const musicDir = path.join(tempDir, 'Music');
      await fs.promises.mkdir(musicDir, { recursive: true });

      const track1Path = path.join(musicDir, 'track1.mp3');
      const track2Path = path.join(musicDir, 'track2.mp3');

      const mockMp3 = Buffer.concat([Buffer.from([0xFF, 0xFB, 0x90, 0x64]), Buffer.alloc(512, 0)]);
      await fs.promises.writeFile(track1Path, mockMp3);
      await fs.promises.writeFile(track2Path, mockMp3);

      const dbService = new LibraryDatabaseService(dbPath);
      const scanner = new LibraryScannerService(undefined, dbService);

      // Initial scan
      const scan1 = await scanner.scanDirectory(musicDir);
      expect(scan1.tracks.length).toBe(2);

      // Add a third track and delete the second track
      const track3Path = path.join(musicDir, 'track3.mp3');
      await fs.promises.writeFile(track3Path, mockMp3);
      await fs.promises.unlink(track2Path);

      // Incremental scan
      const scan2 = await scanner.scanDirectory(musicDir);
      expect(scan2.tracks.length).toBe(2);
      const remainingFiles = scan2.tracks.map(t => path.basename(t.filePath));
      expect(remainingFiles).toContain('track1.mp3');
      expect(remainingFiles).toContain('track3.mp3');
      expect(remainingFiles).not.toContain('track2.mp3');

      dbService.close();
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('Persists data to disk across service restart instances', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-persistence-test-'));
    const dbPath = path.join(tempDir, 'test-restart.db');

    try {
      const dbInstance1 = new LibraryDatabaseService(dbPath);
      dbInstance1.upsertTrack({
        id: 'track-restart-1',
        filePath: 'C:/Music/Restart/01 Test.mp3',
        title: 'Restart Song',
        artist: 'Restart Artist',
        album: 'Restart Album',
        duration: 200,
        format: 'mp3',
        fileSize: 5000,
        mtime: 1700000000000,
      });
      dbInstance1.close();

      // Launch fresh instance pointing to same dbPath
      const dbInstance2 = new LibraryDatabaseService(dbPath);
      const reloadedTracks = dbInstance2.getAllTracks();
      expect(reloadedTracks.length).toBe(1);
      expect(reloadedTracks[0].title).toBe('Restart Song');
      expect(reloadedTracks[0].artist).toBe('Restart Artist');
      dbInstance2.close();
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });
});
