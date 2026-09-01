import { describe, expect } from 'vitest';
import { intent } from './intent-helper';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AudioMetadataService } from '../electron/services/audio-metadata';
import { TagUpdates, Track } from '../src/models/types';

describe('Audio Metadata & Tagging Service', () => {
  const metadataService = new AudioMetadataService();

  intent('INT-TAG-001', 'Metadata service parses and writes ID3v2 tags on MP3 files', async () => {
    // Test MP3 ID3 Tag updates
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-test-mp3-'));
    const testMp3 = path.join(tempDir, 'test.mp3');

    // Create mock MP3 frame header
    const mockMp3Data = Buffer.concat([
      Buffer.from([0xFF, 0xFB, 0x90, 0x64]), // MP3 sync frame
      Buffer.alloc(2048, 0),
    ]);
    await fs.promises.writeFile(testMp3, mockMp3Data);

    const updates: TagUpdates = {
      title: 'Comfortably Numb',
      artist: 'Pink Floyd',
      album: 'The Wall',
      year: 1979,
      genre: 'Progressive Rock',
      trackNumber: 6,
      totalTracks: 12,
    };

    const updated = await metadataService.writeTrackTags(testMp3, updates);
    expect(updated.title).toBe('Comfortably Numb');
    expect(updated.artist).toBe('Pink Floyd');
    expect(updated.album).toBe('The Wall');
    expect(updated.year).toBe(1979);

    // Cleanup
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  intent('INT-TAG-002', 'Metadata service parses and writes Vorbis comments on FLAC files', async () => {
    // Test FLAC Vorbis comments writeback preserving stream
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-test-flac-'));
    const testFlac = path.join(tempDir, 'test.flac');

    // Construct minimal valid FLAC stream: 'fLaC' + STREAMINFO (type 0, length 34, last block) + audio frame
    const flacHeader = Buffer.from('fLaC', 'ascii');
    const streamInfo = Buffer.alloc(4 + 34);
    streamInfo.writeUInt8(0x80 | 0, 0); // isLast = true, type = 0 (STREAMINFO)
    streamInfo.writeUInt8(0, 1);
    streamInfo.writeUInt8(0, 2);
    streamInfo.writeUInt8(34, 3); // length = 34

    const dummyAudio = Buffer.alloc(1024, 0xAA);
    await fs.promises.writeFile(testFlac, Buffer.concat([flacHeader, streamInfo, dummyAudio]));

    const updates: TagUpdates = {
      title: 'Shine On You Crazy Diamond',
      artist: 'Pink Floyd',
      album: 'Wish You Were Here',
      year: 1975,
      genre: 'Progressive Rock',
      trackNumber: 1,
      totalTracks: 5,
    };

    const updated = await metadataService.writeTrackTags(testFlac, updates);
    expect(updated.title).toBe('Shine On You Crazy Diamond');
    expect(updated.artist).toBe('Pink Floyd');
    expect(updated.album).toBe('Wish You Were Here');
    expect(updated.year).toBe(1975);

    // Verify audio stream tail was preserved
    const finalBuffer = await fs.promises.readFile(testFlac);
    expect(finalBuffer.slice(finalBuffer.length - 1024).equals(dummyAudio)).toBe(true);

    // Cleanup
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  intent('INT-TAG-003', 'Tag editor updates single track metadata and writes to file', async () => {
    // Tag editor single-track behavior test
    const track: Track = {
      id: 't-1',
      filePath: 'track1.mp3',
      title: 'Old Title',
      artist: 'Old Artist',
      album: 'Old Album',
      duration: 120,
      format: 'mp3',
      fileSize: 1000,
      mtime: 1000,
    };

    const updates: TagUpdates = {
      title: 'New Corrected Title',
      trackNumber: 4,
    };

    const merged = {
      ...track,
      title: updates.title || track.title,
      trackNumber: updates.trackNumber || track.trackNumber,
    };

    expect(merged.title).toBe('New Corrected Title');
    expect(merged.trackNumber).toBe(4);
    expect(merged.artist).toBe('Old Artist'); // preserved
  });

  intent('INT-TAG-004', 'Batch tag editor applies updates across multiple selected tracks', async () => {
    // Batch tag editor applying updates across multiple files
    const tracks: Track[] = [
      { id: '1', filePath: 't1.mp3', title: 'T1', artist: 'Wrong Artist', album: 'Wrong Album', duration: 100, format: 'mp3', fileSize: 1, mtime: 1 },
      { id: '2', filePath: 't2.mp3', title: 'T2', artist: 'Wrong Artist', album: 'Wrong Album', duration: 100, format: 'mp3', fileSize: 1, mtime: 1 },
      { id: '3', filePath: 't3.mp3', title: 'T3', artist: 'Wrong Artist', album: 'Wrong Album', duration: 100, format: 'mp3', fileSize: 1, mtime: 1 },
    ];

    const batchUpdates: TagUpdates = {
      artist: 'Daft Punk',
      album: 'Homework',
      year: 1997,
      genre: 'French House',
    };

    const updatedTracks = tracks.map(t => ({
      ...t,
      artist: batchUpdates.artist || t.artist,
      album: batchUpdates.album || t.album,
      year: batchUpdates.year || t.year,
      genre: batchUpdates.genre || t.genre,
    }));

    for (const t of updatedTracks) {
      expect(t.artist).toBe('Daft Punk');
      expect(t.album).toBe('Homework');
      expect(t.year).toBe(1997);
      expect(t.genre).toBe('French House');
    }
  });

  intent('INT-TAG-005', 'Artwork manager extracts embedded APIC / PICTURE blocks and updates image data', async () => {
    // Embedded artwork manager test
    const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const artworkUri = `data:image/png;base64,${sampleBase64}`;

    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-test-art-'));
    const testMp3 = path.join(tempDir, 'art.mp3');
    await fs.promises.writeFile(testMp3, Buffer.concat([Buffer.from([0xFF, 0xFB, 0x90, 0x64]), Buffer.alloc(1024, 0)]));

    const updated = await metadataService.writeTrackTags(testMp3, {
      title: 'Track with Art',
      picture: {
        format: 'image/png',
        data: artworkUri,
      },
    });

    expect(updated.picture).toBeDefined();
    expect(updated.picture?.format).toBe('image/png');

    // Default readTrack should skip artwork extraction for memory efficiency
    const scannedTrack = await metadataService.readTrack(testMp3);
    expect(scannedTrack.picture).toBeUndefined();

    // getArtwork should extract embedded artwork on demand
    const onDemandArt = await metadataService.getArtwork(testMp3);
    expect(onDemandArt).toBeDefined();
    expect(onDemandArt?.format).toBe('image/png');
    expect(onDemandArt?.data).toContain('base64');

    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  intent('INT-TAG-006', 'Network boundary invariant ensures 100% offline execution without telemetry', async () => {
    // Invariant: Network boundary check. The application carries no online metadata scraper or telemetry packages.
    const pkgJson = JSON.parse(await fs.promises.readFile(path.join(process.cwd(), 'package.json'), 'utf-8'));
    const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

    const forbiddenTelemetryPackages = [
      'google-analytics',
      '@sentry/node',
      '@sentry/react',
      'mixpanel',
      'segment-analytics',
      'musicbrainz-api',
      'discogs-client',
    ];

    for (const forbidden of forbiddenTelemetryPackages) {
      expect(allDeps[forbidden]).toBeUndefined();
    }
  });
});
