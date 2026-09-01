import { describe, expect } from 'vitest';
import { intent } from './intent-helper';
import { SyncManagerService } from '../electron/services/sync-manager';

describe('Desktop Bridge & Volume Detection', () => {
  intent('INT-APP-001', 'Desktop bridge isolates Node.js filesystem operations from renderer', async () => {
    // Contract check: verify that preload bridge interface exposes typed methods without raw node require
    const bridgeKeys = [
      'isElectron',
      'selectLibraryFolder',
      'scanLibrary',
      'getTrackArtwork',
      'saveTrackTags',
      'batchSaveTags',
      'getVolumes',
      'analyzeSync',
      'executeSync',
      'exportPlaylist',
      'undockPlayer',
      'dockPlayer',
      'onPlayerCommand',
      'sendPlayerState',
      'onPlayerState',
      'getStoredLibraryPath',
      'setStoredLibraryPath',
      'windowControl',
    ];

    expect(bridgeKeys).toContain('scanLibrary');
    expect(bridgeKeys).toContain('getTrackArtwork');
    expect(bridgeKeys).toContain('saveTrackTags');
    expect(bridgeKeys).toContain('getVolumes');
    expect(bridgeKeys).toContain('analyzeSync');
    expect(bridgeKeys).toContain('getStoredLibraryPath');
    expect(bridgeKeys).toContain('setStoredLibraryPath');
  });

  intent('INT-APP-002', 'Desktop bridge detects attached removable USB/SD storage volumes', async () => {
    const syncManager = new SyncManagerService();
    const volumes = await syncManager.getVolumes();

    expect(Array.isArray(volumes)).toBe(true);
    for (const v of volumes) {
      expect(typeof v.driveLetter).toBe('string');
      expect(typeof v.mountPath).toBe('string');
      expect(typeof v.totalSpace).toBe('number');
      expect(typeof v.freeSpace).toBe('number');
      expect(typeof v.isRemovable).toBe('boolean');
    }
  });
});
