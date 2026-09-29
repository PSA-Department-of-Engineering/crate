import { afterEach, beforeEach, describe, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { intent } from './intent-helper';
import {
  AppUpdaterService,
  UpdaterLike,
  isPortableBuild,
} from '../electron/services/app-updater';
import { describeUpdateStatus, canCheckForUpdates } from '../src/utils/update-status';
import { UpdateStatus } from '../src/models/types';

/** Stands in for electron-updater's autoUpdater; tests drive it by emitting its events. */
class FakeUpdater extends EventEmitter implements UpdaterLike {
  autoDownload = false;
  autoInstallOnAppQuit = false;
  checkForUpdates = vi.fn<() => Promise<unknown>>(async () => null);
  quitAndInstall = vi.fn();
}

function setup(overrides: Partial<ConstructorParameters<typeof AppUpdaterService>[0]> = {}) {
  const updater = new FakeUpdater();
  const statuses: UpdateStatus[] = [];
  const getUpdater = vi.fn(() => updater);
  const service = new AppUpdaterService({
    getUpdater,
    isPackaged: true,
    isPortable: false,
    onStatus: status => statuses.push(status),
    startupDelayMs: 1_000,
    checkIntervalMs: 5_000,
    ...overrides,
  });
  return { updater, statuses, getUpdater, service };
}

describe('In-app updates (INT-DIST-003)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  intent('INT-DIST-003', 'updates download in the background and install when the app quits', () => {
    const { updater, service } = setup();
    service.start();

    expect(updater.autoDownload).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(true);
    service.dispose();
  });

  intent('INT-DIST-003', 'status moves from checking through downloading progress to ready', () => {
    const { updater, statuses, service } = setup();
    service.start();

    updater.emit('checking-for-update');
    updater.emit('update-available', { version: '1.2.3' });
    updater.emit('download-progress', { percent: 40.4 });
    updater.emit('update-downloaded', { version: '1.2.3' });

    expect(statuses).toEqual([
      { state: 'checking' },
      { state: 'downloading', version: '1.2.3', percent: 0 },
      { state: 'downloading', version: '1.2.3', percent: 40 },
      { state: 'ready', version: '1.2.3' },
    ]);
    expect(service.getStatus()).toEqual({ state: 'ready', version: '1.2.3' });
    service.dispose();
  });

  intent('INT-DIST-003', 'restart-to-update only acts once an update has been downloaded', () => {
    const { updater, service } = setup();
    service.start();

    expect(service.restartToUpdate()).toBe(false);
    updater.emit('update-available', { version: '1.2.3' });
    expect(service.restartToUpdate()).toBe(false);
    expect(updater.quitAndInstall).not.toHaveBeenCalled();

    updater.emit('update-downloaded', { version: '1.2.3' });
    expect(service.restartToUpdate()).toBe(true);
    // Silent install, then relaunch into the new version.
    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true);
    service.dispose();
  });

  intent('INT-DIST-003', 'unpackaged and portable builds never self-update', async () => {
    for (const overrides of [{ isPackaged: false }, { isPortable: true }]) {
      const { getUpdater, updater, service } = setup(overrides);
      service.start();
      await service.checkNow();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(service.getStatus().state).toBe('disabled');
      expect(getUpdater).not.toHaveBeenCalled();
      expect(updater.checkForUpdates).not.toHaveBeenCalled();
      expect(service.restartToUpdate()).toBe(false);
      service.dispose();
    }

    expect(setup({ isPackaged: false }).service.getStatus()).toEqual({ state: 'disabled', reason: 'unpackaged' });
    expect(setup({ isPortable: true }).service.getStatus()).toEqual({ state: 'disabled', reason: 'portable' });
    expect(isPortableBuild({ PORTABLE_EXECUTABLE_FILE: 'C:\\Crate-Portable-1.0.0.exe' })).toBe(true);
    expect(isPortableBuild({})).toBe(false);
  });

  intent('INT-DIST-003', 'checks shortly after launch and then periodically while running', async () => {
    const { updater, service } = setup();
    service.start();

    await vi.advanceTimersByTimeAsync(999);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);

    service.dispose();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  intent('INT-DIST-003', 'does not re-check while a download is in flight or an update is already ready', async () => {
    const { updater, service } = setup();
    service.start();

    updater.emit('update-available', { version: '1.2.3' });
    await service.checkNow();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();

    updater.emit('update-downloaded', { version: '1.2.3' });
    await service.checkNow();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
    service.dispose();
  });

  intent('INT-DIST-003', 'a failed check surfaces as an error status and the next check retries', async () => {
    const { updater, service } = setup();
    service.start();
    updater.checkForUpdates.mockRejectedValueOnce(new Error('network unreachable'));

    expect(await service.checkNow()).toEqual({ state: 'error', message: 'network unreachable' });
    expect(canCheckForUpdates(service.getStatus())).toBe(true);

    await service.checkNow();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
    service.dispose();
  });

  intent('INT-DIST-003', 'a failed background download cannot become an unhandled rejection', async () => {
    // Real timers: Node only reports unhandled rejections on a later macrotask,
    // which fake timers would never let run.
    vi.useRealTimers();
    const { updater, service } = setup();
    service.start();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      updater.checkForUpdates.mockResolvedValueOnce({
        downloadPromise: Promise.reject(new Error('download interrupted')),
      });
      await service.checkNow();
      await new Promise<void>(resolve => setTimeout(resolve, 25));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
      service.dispose();
    }
  });

  intent('INT-DIST-003', 'the UI describes each state and only offers a manual check when idle', () => {
    expect(describeUpdateStatus({ state: 'up-to-date' })).toMatch(/up to date/i);
    expect(describeUpdateStatus({ state: 'downloading', version: '2.0.0', percent: 12 })).toContain('12%');
    expect(describeUpdateStatus({ state: 'ready', version: '2.0.0' })).toContain('installs when you quit');
    expect(describeUpdateStatus({ state: 'disabled', reason: 'portable' })).toMatch(/portable/i);
    expect(describeUpdateStatus({ state: 'error', message: 'boom' })).toContain('boom');

    expect(canCheckForUpdates({ state: 'idle' })).toBe(true);
    expect(canCheckForUpdates({ state: 'up-to-date' })).toBe(true);
    expect(canCheckForUpdates({ state: 'checking' })).toBe(false);
    expect(canCheckForUpdates({ state: 'downloading', version: '2.0.0', percent: 1 })).toBe(false);
    expect(canCheckForUpdates({ state: 'ready', version: '2.0.0' })).toBe(false);
    expect(canCheckForUpdates({ state: 'disabled', reason: 'unpackaged' })).toBe(false);
  });

  intent('INT-DIST-003', 'the desktop bridge exposes update status, check, install and a status subscription', async () => {
    const read = (file: string) => fs.promises.readFile(path.join(process.cwd(), file), 'utf-8');
    const [main, preload, types] = await Promise.all([
      read('electron/main.ts'),
      read('electron/preload.ts'),
      read('src/models/types.ts'),
    ]);

    for (const channel of ['updater:get-status', 'updater:check', 'updater:install']) {
      expect(main).toContain(`ipcMain.handle('${channel}'`);
      expect(preload).toContain(`'${channel}'`);
    }
    expect(main).toContain("'updater:status'");
    expect(preload).toContain("ipcRenderer.on('updater:status'");
    for (const method of ['getUpdateStatus', 'checkForUpdates', 'installUpdate', 'onUpdateStatus']) {
      expect(preload).toContain(`${method}:`);
      expect(types).toContain(`${method}?:`);
    }
    expect(main).toContain('appUpdater.start()');
  });
});
