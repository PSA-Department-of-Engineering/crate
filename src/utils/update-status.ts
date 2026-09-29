import { UpdateStatus } from '../models/types';

/** One-line, human-readable summary of the updater state for the Settings modal. */
export function describeUpdateStatus(status: UpdateStatus): string {
  switch (status.state) {
    case 'disabled':
      return status.reason === 'portable'
        ? 'The portable build does not update itself. Download a newer version to update.'
        : 'Updates are only available in installed builds.';
    case 'idle':
      return 'Crate checks for updates automatically while it runs.';
    case 'checking':
      return 'Checking for updates...';
    case 'up-to-date':
      return "You're up to date.";
    case 'downloading':
      return `Downloading v${status.version} (${status.percent}%)...`;
    case 'ready':
      return `v${status.version} is ready. Restart to update, or it installs when you quit.`;
    case 'error':
      return `Could not check for updates: ${status.message}`;
  }
}

/** A manual check is only meaningful when nothing is in flight or waiting to install. */
export function canCheckForUpdates(status: UpdateStatus): boolean {
  return status.state === 'idle' || status.state === 'up-to-date' || status.state === 'error';
}
