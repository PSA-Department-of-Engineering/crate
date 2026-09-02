import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SettingsManagerService } from '../electron/services/settings-manager';
import { SettingsModal } from '../src/components/SettingsModal';

describe('Settings Modal & Configuration (#54)', () => {
  let tempDir: string;
  let tempConfigFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crate-settings-modal-test-'));
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

  it('exports SettingsModal component correctly', () => {
    expect(SettingsModal).toBeDefined();
    expect(typeof SettingsModal).toBe('function');
  });

  it('persists and retrieves spotifySecret in settings manager', async () => {
    const manager = new SettingsManagerService(tempConfigFile);
    const testSecret = 'sp_sec_test_secret_12345';

    await manager.saveSettings({ spotifySecret: testSecret });

    expect(fs.existsSync(tempConfigFile)).toBe(true);
    const saved = await manager.getSettings();
    expect(saved.spotifySecret).toBe(testSecret);
  });

  it('persists both libraryPath and spotifySecret together without overwrite', async () => {
    const manager = new SettingsManagerService(tempConfigFile);
    const testPath = 'D:\\Music\\HiRes';
    const testSecret = 'spotify_app_secret_abcxyz';

    await manager.setLibraryPath(testPath);
    await manager.saveSettings({ spotifySecret: testSecret });

    const settings = await manager.getSettings();
    expect(settings.libraryPath).toBe(testPath);
    expect(settings.spotifySecret).toBe(testSecret);
  });

  it('allows updating spotifySecret independently', async () => {
    const manager = new SettingsManagerService(tempConfigFile);

    await manager.saveSettings({
      libraryPath: 'C:\\Audio',
      spotifySecret: 'initial_secret',
    });

    await manager.saveSettings({ spotifySecret: 'updated_secret' });

    const settings = await manager.getSettings();
    expect(settings.libraryPath).toBe('C:\\Audio');
    expect(settings.spotifySecret).toBe('updated_secret');
  });
});
