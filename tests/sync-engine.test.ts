import { describe, it, expect } from 'vitest';
import { intent } from './intent-helper';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { SyncManagerService, getFfmpegPath } from '../electron/services/sync-manager';
import { Track, Playlist } from '../src/models/types';

describe('Car Sync Engine & Delta Synchronization', () => {
  const syncManager = new SyncManagerService();

  const sampleTracks: Track[] = [
    {
      id: '1',
      filePath: '',
      title: 'Time',
      artist: 'Pink Floyd',
      album: 'The Dark Side of the Moon',
      trackNumber: 3,
      duration: 413,
      format: 'mp3',
      fileSize: 10000,
      mtime: 1600000000000,
    },
    {
      id: '2',
      filePath: '',
      title: 'Money',
      artist: 'Pink Floyd',
      album: 'The Dark Side of the Moon',
      trackNumber: 6,
      duration: 382,
      format: 'mp3',
      fileSize: 12000,
      mtime: 1600000000000,
    },
    {
      id: '3',
      filePath: '',
      title: 'Get Lucky',
      artist: 'Daft Punk',
      album: 'Random Access Memories',
      trackNumber: 8,
      duration: 369,
      format: 'mp3',
      fileSize: 15000,
      mtime: 1600000000000,
    },
  ];

  intent('INT-SYNC-001', 'Car sync engine supports scoping to all tracks, playlists, or albums', async () => {
    // Scoping by all
    const all = syncManager.filterTracksByScope(sampleTracks, 'all');
    expect(all.length).toBe(3);

    // Scoping by album
    const albumScope = syncManager.filterTracksByScope(sampleTracks, 'albums', undefined, ['The Dark Side of the Moon']);
    expect(albumScope.length).toBe(2);
    expect(albumScope.every(t => t.album === 'The Dark Side of the Moon')).toBe(true);

    // Scoping by playlist
    const playlists: Playlist[] = [
      { id: 'pl-1', name: 'Electronic', trackIds: ['3'], createdAt: 0, updatedAt: 0 },
    ];
    const playlistScope = syncManager.filterTracksByScope(sampleTracks, 'playlists', playlists);
    expect(playlistScope.length).toBe(1);
    expect(playlistScope[0].title).toBe('Get Lucky');
  });

  intent('INT-SYNC-002', 'Delta sync engine copies only modified or missing files to target media', async () => {
    // Delta sync engine tests: copy missing or modified files only
    const tempSourceDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-sync-src-'));
    const tempDestDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-sync-dst-'));

    const srcFile1 = path.join(tempSourceDir, 'track1.mp3');
    const srcFile2 = path.join(tempSourceDir, 'track2.mp3');

    await fs.promises.writeFile(srcFile1, Buffer.alloc(5000, 0x11));
    await fs.promises.writeFile(srcFile2, Buffer.alloc(7000, 0x22));

    const tracks: Track[] = [
      {
        id: '1',
        filePath: srcFile1,
        title: 'Song 1',
        artist: 'Band A',
        album: 'Album A',
        trackNumber: 1,
        duration: 120,
        format: 'mp3',
        fileSize: 5000,
        mtime: 1600000000000,
      },
      {
        id: '2',
        filePath: srcFile2,
        title: 'Song 2',
        artist: 'Band A',
        album: 'Album A',
        trackNumber: 2,
        duration: 180,
        format: 'mp3',
        fileSize: 7000,
        mtime: 1600000000000,
      },
    ];

    // Initial analysis: both should be 'add'
    const plan1 = await syncManager.analyzeSync({
      sourceTracks: tracks,
      targetVolumePath: tempDestDir,
      scope: 'all',
    });

    expect(plan1.items.length).toBe(2);
    expect(plan1.items[0].action).toBe('add');
    expect(plan1.items[1].action).toBe('add');
    expect(plan1.totalFilesToTransfer).toBe(2);

    // Execute first sync
    const res1 = await syncManager.executeSync({
      plan: plan1,
      targetVolumePath: tempDestDir,
      pruneStale: false,
    });
    expect(res1.success).toBe(true);
    expect(res1.copied).toBe(2);

    // Second analysis without changes: both should be 'keep'
    const plan2 = await syncManager.analyzeSync({
      sourceTracks: tracks,
      targetVolumePath: tempDestDir,
      scope: 'all',
    });

    expect(plan2.items[0].action).toBe('keep');
    expect(plan2.items[1].action).toBe('keep');
    expect(plan2.totalFilesToTransfer).toBe(0);

    // Cleanup
    await fs.promises.rm(tempSourceDir, { recursive: true, force: true });
    await fs.promises.rm(tempDestDir, { recursive: true, force: true });
  });

  intent('INT-SYNC-003', 'Stale file detector finds orphaned tracks and junk files on destination drive for pruning', async () => {
    // Stale file detection on destination drive
    const tempDestDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-stale-dst-'));
    const staleFolder = path.join(tempDestDir, 'Old Artist', 'Old Album');
    await fs.promises.mkdir(staleFolder, { recursive: true });
    const staleFile = path.join(staleFolder, '01 Old Track.mp3');
    const desktopIni = path.join(staleFolder, 'desktop.ini');
    const macStub = path.join(staleFolder, '._01 Old Track.mp3');

    await fs.promises.writeFile(staleFile, Buffer.alloc(1000, 0x99));
    await fs.promises.writeFile(desktopIni, Buffer.from('[.ShellClassInfo]'));
    await fs.promises.writeFile(macStub, Buffer.alloc(50, 0x00));

    const plan = await syncManager.analyzeSync({
      sourceTracks: sampleTracks,
      targetVolumePath: tempDestDir,
      scope: 'all',
    });

    expect(plan.staleFiles.length).toBe(3);
    expect(plan.staleFiles.some(f => f.includes('01 Old Track.mp3'))).toBe(true);
    expect(plan.staleFiles.some(f => f.includes('desktop.ini'))).toBe(true);
    expect(plan.staleFiles.some(f => f.includes('._01 Old Track.mp3'))).toBe(true);

    // Execute with pruneStale = true
    const res = await syncManager.executeSync({
      plan,
      targetVolumePath: tempDestDir,
      pruneStale: true,
    });

    expect(res.deleted).toBe(3);
    const staleExists = await fs.promises.access(staleFile).then(() => true).catch(() => false);
    const iniExists = await fs.promises.access(desktopIni).then(() => true).catch(() => false);
    const stubExists = await fs.promises.access(macStub).then(() => true).catch(() => false);

    expect(staleExists).toBe(false);
    expect(iniExists).toBe(false);
    expect(stubExists).toBe(false);

    await fs.promises.rm(tempDestDir, { recursive: true, force: true });
  });

  describe('Automotive Transcoding & .crate-sync.json Manifest (#63, #64)', () => {
    it('detects 32-bit float WAV and sets targetFormat to flac with needsTranscode', async () => {
      const tempDestDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-transcode-dst-'));
      const wav32Track: Track = {
        id: 'wav-32',
        filePath: 'C:/Music/Producer/Album/Beat.wav',
        title: 'Beat',
        artist: 'Producer',
        album: 'Beats',
        trackNumber: 1,
        duration: 120,
        format: 'wav',
        codec: 'IEEE_FLOAT',
        bitsPerSample: 32,
        fileSize: 80000000,
        mtime: 1600000000000,
      };

      const plan = await syncManager.analyzeSync({
        sourceTracks: [wav32Track],
        targetVolumePath: tempDestDir,
        scope: 'all',
      });

      expect(plan.items.length).toBe(1);
      expect(plan.items[0].needsTranscode).toBe(true);
      expect(plan.items[0].targetFormat).toBe('flac');
      expect(plan.items[0].targetRelativePath).toMatch(/\.flac$/);

      await fs.promises.rm(tempDestDir, { recursive: true, force: true });
    });

    it('writes .crate-sync.json manifest on sync and keeps transcoded files on repeat runs', async () => {
      const tempDestDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-manifest-dst-'));
      const tempSrcDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-manifest-src-'));

      const testFile = path.join(tempSrcDir, 'test.mp3');
      await fs.promises.writeFile(testFile, Buffer.alloc(2000, 0x55));

      const track: Track = {
        id: 'track-manifest-1',
        filePath: testFile,
        title: 'Manifest Song',
        artist: 'Artist',
        album: 'Album',
        trackNumber: 1,
        duration: 60,
        format: 'mp3',
        fileSize: 2000,
        mtime: 1600000000000,
      };

      const plan1 = await syncManager.analyzeSync({
        sourceTracks: [track],
        targetVolumePath: tempDestDir,
        scope: 'all',
      });

      expect(plan1.items[0].action).toBe('add');

      await syncManager.executeSync({
        plan: plan1,
        targetVolumePath: tempDestDir,
        pruneStale: false,
      });

      // Verify .crate-sync.json was created on target
      const manifestPath = path.join(tempDestDir, '.crate-sync.json');
      const manifestExists = await fs.promises.access(manifestPath).then(() => true).catch(() => false);
      expect(manifestExists).toBe(true);

      const manifestContent = JSON.parse(await fs.promises.readFile(manifestPath, 'utf-8'));
      expect(manifestContent.files).toBeDefined();
      expect(Object.keys(manifestContent.files).length).toBe(1);

      // Repeat analysis: should be recognized via manifest as 'keep'
      const plan2 = await syncManager.analyzeSync({
        sourceTracks: [track],
        targetVolumePath: tempDestDir,
        scope: 'all',
      });

      expect(plan2.items[0].action).toBe('keep');
      expect(plan2.totalFilesToTransfer).toBe(0);

      await fs.promises.rm(tempSrcDir, { recursive: true, force: true });
      await fs.promises.rm(tempDestDir, { recursive: true, force: true });
    });
  });
  describe('Car-incompatible WAV transcoding on sync', () => {
    const execFileAsync = promisify(execFile);

    /** Writes a real 32-bit float WAV, as a DAW export would produce. */
    async function writeFloatWav(dest: string) {
      await execFileAsync(getFfmpegPath(), [
        '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
        '-c:a', 'pcm_f32le', '-metadata', 'title=Night Drive',
        '-metadata', 'artist=Producer', '-metadata', 'album=Masters', dest,
      ]);
    }

    async function makeFixture() {
      const srcDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-wav-src-'));
      const destDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-wav-dst-'));
      const wavPath = path.join(srcDir, 'Night Drive.wav');
      await writeFloatWav(wavPath);
      const stat = await fs.promises.stat(wavPath);

      const track: Track = {
        id: wavPath,
        filePath: wavPath,
        title: 'Night Drive',
        artist: 'Producer',
        album: 'Masters',
        trackNumber: 1,
        duration: 2,
        format: 'wav',
        bitsPerSample: 32,
        fileSize: stat.size,
        mtime: stat.mtimeMs,
      };

      return { srcDir, destDir, wavPath, track };
    }

    const cleanup = async (...dirs: string[]) => {
      for (const d of dirs) await fs.promises.rm(d, { recursive: true, force: true });
    };

    intent('INT-SYNC-004', 'Sync converts car-incompatible WAV to FLAC on the drive and leaves the PC master untouched', async () => {
      const { srcDir, destDir, wavPath, track } = await makeFixture();
      const before = await fs.promises.stat(wavPath);

      const plan = await syncManager.analyzeSync({
        sourceTracks: [track], targetVolumePath: destDir, scope: 'all',
      });

      expect(plan.items[0].needsTranscode).toBe(true);
      expect(plan.items[0].targetFormat).toBe('flac');
      expect(plan.items[0].targetRelativePath).toMatch(/\.flac$/i);

      await syncManager.executeSync({ plan, targetVolumePath: destDir, pruneStale: false });

      // The converted file is on the drive...
      const destFile = path.join(destDir, plan.items[0].targetRelativePath);
      expect(fs.existsSync(destFile)).toBe(true);

      // ...and the master is still on the PC, byte for byte.
      const after = await fs.promises.stat(wavPath);
      expect(fs.existsSync(wavPath)).toBe(true);
      expect(after.size).toBe(before.size);
      expect(after.mtimeMs).toBe(before.mtimeMs);

      // No WAV was written to the drive.
      const destNames = await fs.promises.readdir(destDir, { recursive: true } as any);
      expect((destNames as string[]).some(n => String(n).toLowerCase().endsWith('.wav'))).toBe(false);

      await cleanup(srcDir, destDir);
    });

    intent('INT-SYNC-004', 'A second sync keeps an already-converted track instead of re-encoding it', async () => {
      const { srcDir, destDir, track } = await makeFixture();

      const plan1 = await syncManager.analyzeSync({
        sourceTracks: [track], targetVolumePath: destDir, scope: 'all',
      });
      await syncManager.executeSync({ plan: plan1, targetVolumePath: destDir, pruneStale: false });

      const destFile = path.join(destDir, plan1.items[0].targetRelativePath);
      const encodedAt = (await fs.promises.stat(destFile)).mtimeMs;

      const plan2 = await syncManager.analyzeSync({
        sourceTracks: [track], targetVolumePath: destDir, scope: 'all',
      });

      expect(plan2.items[0].action).toBe('keep');
      expect(plan2.totalFilesToTransfer).toBe(0);

      // Nothing re-encoded it.
      await syncManager.executeSync({ plan: plan2, targetVolumePath: destDir, pruneStale: false });
      expect((await fs.promises.stat(destFile)).mtimeMs).toBe(encodedAt);

      await cleanup(srcDir, destDir);
    });

    // Regression: the manifest-miss fallback could not size-compare a transcoded
    // file, so it fell through to 'update' and re-encoded every WAV on the drive.
    intent('INT-SYNC-004', 'A lost manifest does not trigger a full re-encode of already-converted tracks', async () => {
      const { srcDir, destDir, track } = await makeFixture();

      const plan1 = await syncManager.analyzeSync({
        sourceTracks: [track], targetVolumePath: destDir, scope: 'all',
      });
      await syncManager.executeSync({ plan: plan1, targetVolumePath: destDir, pruneStale: false });

      await fs.promises.rm(path.join(destDir, '.crate-sync.json'), { force: true });

      const plan2 = await syncManager.analyzeSync({
        sourceTracks: [track], targetVolumePath: destDir, scope: 'all',
      });

      expect(plan2.items[0].action).toBe('keep');
      expect(plan2.totalFilesToTransfer).toBe(0);

      await cleanup(srcDir, destDir);
    });

    intent('INT-SYNC-004', 'An edited WAV master is re-converted on the next sync', async () => {
      const { srcDir, destDir, wavPath, track } = await makeFixture();

      const plan1 = await syncManager.analyzeSync({
        sourceTracks: [track], targetVolumePath: destDir, scope: 'all',
      });
      await syncManager.executeSync({ plan: plan1, targetVolumePath: destDir, pruneStale: false });

      // Re-export the master, as re-bouncing a mix would. The mtime is pushed
      // explicitly rather than relying on wall clock: a real re-bounce lands
      // well outside the 2s FAT32 tolerance, but the test writes both files in
      // the same tick.
      await writeFloatWav(wavPath);
      const bumped = new Date(Date.now() + 60_000);
      await fs.promises.utimes(wavPath, bumped, bumped);
      const restat = await fs.promises.stat(wavPath);
      const editedTrack: Track = { ...track, mtime: restat.mtimeMs, fileSize: restat.size };

      const plan2 = await syncManager.analyzeSync({
        sourceTracks: [editedTrack], targetVolumePath: destDir, scope: 'all',
      });

      expect(plan2.items[0].action).toBe('update');
      expect(plan2.items[0].needsTranscode).toBe(true);

      await cleanup(srcDir, destDir);
    });
  });
});
