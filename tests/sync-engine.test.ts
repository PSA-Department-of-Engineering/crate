import { describe, it, expect } from 'vitest';
import { intent } from './intent-helper';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SyncManagerService } from '../electron/services/sync-manager';
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
});

