import { describe, expect } from 'vitest';
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

  intent('INT-SYNC-003', 'Stale file detector finds orphaned tracks on destination drive for pruning', async () => {
    // Stale file detection on destination drive
    const tempDestDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-stale-dst-'));
    const staleFolder = path.join(tempDestDir, 'Old Artist', 'Old Album');
    await fs.promises.mkdir(staleFolder, { recursive: true });
    const staleFile = path.join(staleFolder, '01 Old Track.mp3');
    await fs.promises.writeFile(staleFile, Buffer.alloc(1000, 0x99));

    const plan = await syncManager.analyzeSync({
      sourceTracks: sampleTracks,
      targetVolumePath: tempDestDir,
      scope: 'all',
    });

    expect(plan.staleFiles.length).toBe(1);
    expect(plan.staleFiles[0]).toContain('Old Artist/Old Album/01 Old Track.mp3');

    // Execute with pruneStale = true
    const res = await syncManager.executeSync({
      plan,
      targetVolumePath: tempDestDir,
      pruneStale: true,
    });

    expect(res.deleted).toBe(1);
    const exists = await fs.promises.access(staleFile).then(() => true).catch(() => false);
    expect(exists).toBe(false);

    await fs.promises.rm(tempDestDir, { recursive: true, force: true });
  });
});
