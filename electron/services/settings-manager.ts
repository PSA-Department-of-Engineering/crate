import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface AppSettings {
  libraryPath?: string;
  [key: string]: any;
}

export class SettingsManagerService {
  private configPath: string;

  constructor(customConfigPath?: string) {
    if (customConfigPath) {
      this.configPath = customConfigPath;
    } else {
      try {
        const userDataDir = typeof app !== 'undefined' && app?.getPath ? app.getPath('userData') : path.join(process.cwd(), '.config');
        this.configPath = path.join(userDataDir, 'config.json');
      } catch {
        this.configPath = path.join(process.cwd(), '.config', 'config.json');
      }
    }
  }

  /**
   * Get the path to the configuration store file.
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Read settings from the JSON configuration store in AppData / userData.
   */
  async getSettings(): Promise<AppSettings> {
    try {
      if (!fs.existsSync(this.configPath)) {
        return {};
      }
      const data = await fs.promises.readFile(this.configPath, 'utf-8');
      return JSON.parse(data) as AppSettings;
    } catch (err) {
      console.error('Failed to read config from', this.configPath, err);
      return {};
    }
  }

  /**
   * Save or update settings in the JSON configuration store.
   */
  async saveSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...updates };

      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      await fs.promises.writeFile(this.configPath, JSON.stringify(updated, null, 2), 'utf-8');
      return updated;
    } catch (err) {
      console.error('Failed to save config to', this.configPath, err);
      throw err;
    }
  }

  /**
   * Get the stored library path from settings.
   */
  async getLibraryPath(): Promise<string | null> {
    const settings = await this.getSettings();
    return settings.libraryPath || null;
  }

  /**
   * Persist the chosen library path to settings.
   */
  async setLibraryPath(libraryPath: string): Promise<void> {
    await this.saveSettings({ libraryPath });
  }
}
