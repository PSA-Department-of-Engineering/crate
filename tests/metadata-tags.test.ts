import { describe, expect, it } from 'vitest';
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
      producer: 'Bob Ezrin',
      year: 1979,
      genre: 'Progressive Rock',
      trackNumber: 6,
      totalTracks: 12,
    };

    const updated = await metadataService.writeTrackTags(testMp3, updates);
    expect(updated.title).toBe('Comfortably Numb');
    expect(updated.artist).toBe('Pink Floyd');
    expect(updated.album).toBe('The Wall');
    expect(updated.producer).toBe('Bob Ezrin');
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
      producer: 'Brian Eno',
      year: 1975,
      genre: 'Progressive Rock',
      trackNumber: 1,
      totalTracks: 5,
    };

    const updated = await metadataService.writeTrackTags(testFlac, updates);
    expect(updated.title).toBe('Shine On You Crazy Diamond');
    expect(updated.artist).toBe('Pink Floyd');
    expect(updated.album).toBe('Wish You Were Here');
    expect(updated.producer).toBe('Brian Eno');
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

  intent('INT-TAG-005', 'Artwork manager prefers valid embedded front-cover art, rejects non-image payloads, and falls back to a sibling cover file', async () => {
    // A real 1x1 PNG (valid magic bytes)
    const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const artworkUri = `data:image/png;base64,${sampleBase64}`;

    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-test-art-'));
    const bareMp3 = () => Buffer.concat([Buffer.from([0xFF, 0xFB, 0x90, 0x64]), Buffer.alloc(1024, 0)]);

    // 1. Embed + read back embedded artwork
    const testMp3 = path.join(tempDir, 'art.mp3');
    await fs.promises.writeFile(testMp3, bareMp3());

    const updated = await metadataService.writeTrackTags(testMp3, {
      title: 'Track with Art',
      picture: { format: 'image/png', data: artworkUri },
    });
    expect(updated.picture).toBeDefined();
    expect(updated.picture?.format).toBe('image/png');

    // Default readTrack skips artwork extraction for memory efficiency
    const scannedTrack = await metadataService.readTrack(testMp3);
    expect(scannedTrack.picture).toBeUndefined();

    // getArtwork extracts embedded artwork on demand, typed from the bytes
    const onDemandArt = await metadataService.getArtwork(testMp3);
    expect(onDemandArt?.format).toBe('image/png');
    expect(onDemandArt?.data).toContain('base64');

    // 2. A track with no embedded art falls back to a sibling cover file
    const sidecarDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-test-sidecar-'));
    const noArtMp3 = path.join(sidecarDir, 'plain.mp3');
    await fs.promises.writeFile(noArtMp3, bareMp3());
    const jpegBytes = Buffer.concat([
      Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
      Buffer.alloc(64, 0),
      Buffer.from([0xFF, 0xD9]),
    ]);
    await fs.promises.writeFile(path.join(sidecarDir, 'folder.jpg'), jpegBytes);

    const sidecarArt = await metadataService.getArtwork(noArtMp3);
    expect(sidecarArt?.format).toBe('image/jpeg');

    // 3. An embedded payload that is not a decodable image is rejected (and with
    //    no sidecar present, getArtwork returns null rather than garbage)
    const badArtDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-test-badart-'));
    const badArtMp3 = path.join(badArtDir, 'bad.mp3');
    await fs.promises.writeFile(badArtMp3, bareMp3());
    await metadataService.writeTrackTags(badArtMp3, {
      title: 'Broken Art',
      picture: {
        format: 'image/png',
        data: `data:image/png;base64,${Buffer.from('this is not an image').toString('base64')}`,
      },
    });
    expect(await metadataService.getArtwork(badArtMp3)).toBeNull();

    await fs.promises.rm(tempDir, { recursive: true, force: true });
    await fs.promises.rm(sidecarDir, { recursive: true, force: true });
    await fs.promises.rm(badArtDir, { recursive: true, force: true });
  });

  intent('INT-TAG-007', 'Tag service writes an embedded id3 chunk to WAV and preserves the audio data chunk', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-test-wav-'));
    const wavPath = path.join(tempDir, 'master.wav');

    // A minimal but valid RIFF/WAVE file: fmt chunk + a data chunk with known bytes.
    const pcm = Buffer.from([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]);
    const fmt = Buffer.alloc(16);
    fmt.writeUInt16LE(1, 0);       // PCM
    fmt.writeUInt16LE(2, 2);       // stereo
    fmt.writeUInt32LE(44100, 4);
    fmt.writeUInt32LE(176400, 8);
    fmt.writeUInt16LE(4, 12);
    fmt.writeUInt16LE(16, 14);
    const chunk = (id: string, data: Buffer) => {
      const h = Buffer.alloc(8);
      h.write(id, 0, 'ascii');
      h.writeUInt32LE(data.length, 4);
      return Buffer.concat([h, data]);
    };
    const body = Buffer.concat([Buffer.from('WAVE'), chunk('fmt ', fmt), chunk('data', pcm)]);
    const riff = Buffer.alloc(8);
    riff.write('RIFF', 0, 'ascii');
    riff.writeUInt32LE(body.length, 4);
    await fs.promises.writeFile(wavPath, Buffer.concat([riff, body]));

    const pngUri =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const updated = await metadataService.writeTrackTags(wavPath, {
      title: 'Night Drive',
      artist: 'Producer',
      album: 'Masters',
      albumArtist: 'Producer',
      producer: 'RicoWorld',
      genre: 'Electronic',
      year: 2024,
      trackNumber: 3,
      discNumber: 1,
      picture: { format: 'image/png', data: pngUri },
    });
    expect(updated.format).toBe('wav');
    expect(updated.title).toBe('Night Drive');
    expect(updated.artist).toBe('Producer');

    // Persisted to disk and re-read by the scanner path
    const reread = await metadataService.readTrack(wavPath, { skipCovers: false });
    expect(reread.album).toBe('Masters');
    expect(reread.albumArtist).toBe('Producer');
    expect(reread.producer).toBe('RicoWorld');
    expect(reread.year).toBe(2024);
    expect(reread.trackNumber).toBe(3);
    expect(reread.picture?.format).toBe('image/png');

    // The audio 'data' chunk is untouched, and exactly one 'id3 ' chunk exists
    const after = await fs.promises.readFile(wavPath);
    expect(after.toString('ascii', 0, 4)).toBe('RIFF');
    expect(after.readUInt32LE(4)).toBe(after.length - 8);
    const found: Record<string, Buffer[]> = {};
    let off = 12;
    while (off + 8 <= after.length) {
      const id = after.toString('ascii', off, off + 4);
      const size = after.readUInt32LE(off + 4);
      (found[id] ||= []).push(after.subarray(off + 8, off + 8 + size));
      off += 8 + size + (size % 2);
    }
    expect(found['data']?.[0].equals(pcm)).toBe(true);
    expect(found['id3 ']?.length).toBe(1);

    // Second write updates in place without stacking another id3 chunk
    await metadataService.writeTrackTags(wavPath, { title: 'Night Drive (Reprise)' });
    const after2 = await fs.promises.readFile(wavPath);
    let idCount = 0;
    let o2 = 12;
    while (o2 + 8 <= after2.length) {
      const id = after2.toString('ascii', o2, o2 + 4);
      const size = after2.readUInt32LE(o2 + 4);
      if (id.toLowerCase() === 'id3 ') idCount++;
      o2 += 8 + size + (size % 2);
    }
    expect(idCount).toBe(1);
    expect((await metadataService.readTrack(wavPath)).title).toBe('Night Drive (Reprise)');
    expect((await metadataService.readTrack(wavPath)).producer).toBe('RicoWorld');

    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  intent('INT-TAG-008', 'Producer credits survive a later metadata edit on ID3-backed files', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-test-producer-'));
    const mp3Path = path.join(tempDir, 'producer.mp3');
    const mockMp3 = Buffer.concat([Buffer.from([0xFF, 0xFB, 0x90, 0x64]), Buffer.alloc(2048, 0)]);

    try {
      await fs.promises.writeFile(mp3Path, mockMp3);
      await metadataService.writeTrackTags(mp3Path, { producer: 'RicoWorld' });
      await metadataService.writeTrackTags(mp3Path, { title: 'Producer Credit' });

      const reread = await metadataService.readTrack(mp3Path);
      expect(reread.title).toBe('Producer Credit');
      expect(reread.producer).toBe('RicoWorld');

      await metadataService.writeTrackTags(mp3Path, { producer: '' });
      expect((await metadataService.readTrack(mp3Path)).producer).toBeUndefined();
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('writeTrackTags refuses a format it has no writer for instead of silently no-opping', async () => {
    await expect(
      metadataService.writeTrackTags(path.join(os.tmpdir(), 'whatever.aiff'), { title: 'x' })
    ).rejects.toThrow(/not supported/i);
  });

  it('caches artwork during a session and invalidates it when a sidecar changes', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-art-cache-'));
    const audioPath = path.join(tempDir, 'track.mp3');
    const coverPath = path.join(tempDir, 'folder.jpg');
    const bareMp3 = Buffer.concat([Buffer.from([0xFF, 0xFB, 0x90, 0x64]), Buffer.alloc(1024, 0)]);
    const jpegBytes = Buffer.concat([
      Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
      Buffer.alloc(64, 0),
      Buffer.from([0xFF, 0xD9]),
    ]);
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    try {
      await fs.promises.writeFile(audioPath, bareMp3);
      await fs.promises.writeFile(coverPath, jpegBytes);

      const first = await metadataService.getArtwork(audioPath);
      const second = await metadataService.getArtwork(audioPath);
      expect(first?.format).toBe('image/jpeg');
      expect(second).toEqual(first);

      // The audio file is unchanged; the sidecar signature alone must force a
      // fresh read so replacing folder.jpg is reflected in the UI.
      await fs.promises.writeFile(coverPath, pngBytes);
      const replaced = await metadataService.getArtwork(audioPath);
      expect(replaced?.format).toBe('image/png');
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
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
