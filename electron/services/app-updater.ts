import type { UpdateStatus } from '../../src/models/types';

/** First check runs shortly after launch so it never competes with startup. */
export const UPDATE_STARTUP_DELAY_MS = 15_000;
/** The app can stay open for days, so it keeps checking while running. */
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * The slice of electron-updater's AppUpdater this service relies on. Keeping it
 * this narrow lets the update lifecycle be driven by a fake in tests, without
 * an Electron runtime.
 */
export interface UpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export interface AppUpdaterOptions {
  /**
   * Resolved lazily, and only when updating is enabled. electron-updater builds
   * its platform updater on first access, which is pointless in a dev run or the
   * portable build.
   */
  getUpdater: () => UpdaterLike;
  isPackaged: boolean;
  isPortable: boolean;
  onStatus?: (status: UpdateStatus) => void;
  log?: (message: string) => void;
  startupDelayMs?: number;
  checkIntervalMs?: number;
}

/**
 * electron-builder's portable target sets PORTABLE_EXECUTABLE_FILE. A portable
 * copy shares the installed app's update feed, so left alone it would download
 * the Setup installer and install a second copy instead of updating itself.
 */
export function isPortableBuild(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.PORTABLE_EXECUTABLE_FILE);
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Unknown update error';
}

/**
 * Keeps an installed Crate current (INT-DIST-003). Updates download in the
 * background and install when the app quits; once one is downloaded the status
 * becomes `ready` so the UI can offer to restart into it right away.
 */
export class AppUpdaterService {
  private status: UpdateStatus;
  private readonly enabled: boolean;
  private updater: UpdaterLike | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private readonly options: AppUpdaterOptions) {
    if (!options.isPackaged) {
      this.status = { state: 'disabled', reason: 'unpackaged' };
    } else if (options.isPortable) {
      this.status = { state: 'disabled', reason: 'portable' };
    } else {
      this.status = { state: 'idle' };
    }
    this.enabled = this.status.state !== 'disabled';
  }

  getStatus(): UpdateStatus {
    return this.status;
  }

  /**
   * Wires the updater and schedules the launch check plus the periodic check.
   * A no-op in builds that never self-update.
   */
  start(): void {
    if (!this.enabled || this.updater) return;

    const updater = this.options.getUpdater();
    this.updater = updater;
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;

    updater.on('checking-for-update', () => this.setStatus({ state: 'checking' }));
    updater.on('update-not-available', () => this.setStatus({ state: 'up-to-date' }));
    updater.on('update-available', (info: { version: string }) => {
      this.setStatus({ state: 'downloading', version: info.version, percent: 0 });
    });
    updater.on('download-progress', (progress: { percent: number }) => {
      if (this.status.state !== 'downloading') return;
      this.setStatus({ ...this.status, percent: Math.round(progress.percent) });
    });
    updater.on('update-downloaded', (info: { version: string }) => {
      this.setStatus({ state: 'ready', version: info.version });
    });
    updater.on('error', (err: unknown) => {
      this.options.log?.(`Update error: ${describeError(err)}`);
      this.setStatus({ state: 'error', message: describeError(err) });
    });

    const startupDelay = this.options.startupDelayMs ?? UPDATE_STARTUP_DELAY_MS;
    const interval = this.options.checkIntervalMs ?? UPDATE_CHECK_INTERVAL_MS;
    const first = setTimeout(() => void this.checkNow(), startupDelay);
    const recurring = setInterval(() => void this.checkNow(), interval);
    // Neither timer should keep the process alive on its own.
    first.unref?.();
    recurring.unref?.();
    this.timers.push(first, recurring);
  }

  /**
   * Runs one check. Skipped while a check or download is in flight, and once an
   * update is already downloaded: there is nothing newer to fetch until restart.
   */
  async checkNow(): Promise<UpdateStatus> {
    if (!this.updater) return this.status;
    const { state } = this.status;
    if (state === 'checking' || state === 'downloading' || state === 'ready') {
      return this.status;
    }

    try {
      const result = (await this.updater.checkForUpdates()) as
        | { downloadPromise?: Promise<unknown> | null }
        | null
        | undefined;
      // A failed download already surfaced through the 'error' event. Swallow
      // the rejection here so it cannot become an unhandled one in the main process.
      result?.downloadPromise?.catch(() => undefined);
    } catch (err) {
      this.options.log?.(`Update check failed: ${describeError(err)}`);
      this.setStatus({ state: 'error', message: describeError(err) });
    }
    return this.status;
  }

  /**
   * Quits and installs the downloaded update, then relaunches. Returns false
   * (and does nothing) unless an update is actually downloaded.
   */
  restartToUpdate(): boolean {
    if (this.status.state !== 'ready' || !this.updater) return false;
    this.updater.quitAndInstall(true, true);
    return true;
  }

  dispose(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.timers = [];
  }

  private setStatus(next: UpdateStatus): void {
    if (JSON.stringify(next) === JSON.stringify(this.status)) return;
    this.status = next;
    this.options.onStatus?.(next);
  }
}
