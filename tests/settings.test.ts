import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SettingsManagerService } from '../electron/services/settings-manager';

describe('Settings & AppData Storage Manager', () => {
  let tempDir: string;
  let tempConfigFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crate-settings-test-'));
    tempConfigFile = path.join(tempDir, 'config.json');
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it('returns empty settings and null library path when config.json does not exist', async () => {
    const manager = new SettingsManagerService(tempConfigFile);
    const settings = await manager.getSettings();
    expect(settings).toEqual({});

    const libraryPath = await manager.getLibraryPath();
    expect(libraryPath).toBeNull();
  });

  it('persists and retrieves chosen library path in config.json', async () => {
    const manager = new SettingsManagerService(tempConfigFile);
    const testPath = 'C:\\Music\\Collection';

    await manager.setLibraryPath(testPath);

    expect(fs.existsSync(tempConfigFile)).toBe(true);
    const fileContent = JSON.parse(fs.readFileSync(tempConfigFile, 'utf-8'));
    expect(fileContent.libraryPath).toBe(testPath);

    const retrievedPath = await manager.getLibraryPath();
    expect(retrievedPath).toBe(testPath);
  });

  it('updates settings without losing other stored keys', async () => {
    const manager = new SettingsManagerService(tempConfigFile);

    await manager.saveSettings({ theme: 'dark', volume: 0.8 });
    await manager.setLibraryPath('D:\\Audio');

    const updated = await manager.getSettings();
    expect(updated.libraryPath).toBe('D:\\Audio');
    expect(updated.theme).toBe('dark');
    expect(updated.volume).toBe(0.8);
  });

  it('persists and retrieves customArtistArtworks dictionary in settings (#96)', async () => {
    const manager = new SettingsManagerService(tempConfigFile);
    const customArtworks = {
      'pink floyd': { format: 'image/jpeg', data: 'data:image/jpeg;base64,floyd_cover' },
      'daft punk': { format: 'image/png', data: 'data:image/png;base64,daft_cover' },
    };

    await manager.saveSettings({ customArtistArtworks: customArtworks });

    const settings = await manager.getSettings();
    expect(settings.customArtistArtworks).toEqual(customArtworks);
    expect(settings.customArtistArtworks['pink floyd'].data).toBe('data:image/jpeg;base64,floyd_cover');
  });

  it('handles corrupted JSON in config.json gracefully without crashing', async () => {
    fs.writeFileSync(tempConfigFile, '{ corrupted json :::: ');
    const manager = new SettingsManagerService(tempConfigFile);

    const settings = await manager.getSettings();
    expect(settings).toEqual({});

    const libraryPath = await manager.getLibraryPath();
    expect(libraryPath).toBeNull();
  });
});
