import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Track, Playlist, VolumeInfo, SyncPlan, SyncPlanItem, SyncProgress } from '../../src/models/types';
import { getCarRelativePath } from './file-organizer';
import { PlaylistExporterService } from './playlist-exporter';

const execAsync = promisify(exec);

export class SyncManagerService {
  /**
   * Scans and returns connected removable storage volumes (USB drives / SD cards).
   */
  async getVolumes(): Promise<VolumeInfo[]> {
    const volumes: VolumeInfo[] = [];

    if (process.platform === 'win32') {
      try {
        // Use PowerShell Get-Volume to detect removable drives
        const psCommand = `powershell -NoProfile -Command "Get-Volume | Select-Object DriveLetter, FileSystemLabel, Size, SizeRemaining, DriveType | ConvertTo-Json -Compress"`;
        const { stdout } = await execAsync(psCommand);
        if (stdout && stdout.trim()) {
          const raw = JSON.parse(stdout.trim());
          const list = Array.isArray(raw) ? raw : [raw];

          for (const v of list) {
            if (v.DriveLetter) {
              const driveLetter = `${v.DriveLetter}:`;
              const mountPath = `${driveLetter}\\`;
              const isRemovable = v.DriveType === 'Removable' || v.DriveType === 2;
              volumes.push({
                driveLetter,
                mountPath,
                label: v.FileSystemLabel || (isRemovable ? 'USB Drive' : 'Local Disk'),
                totalSpace: v.Size || 0,
                freeSpace: v.SizeRemaining || 0,
                isRemovable,
              });
            }
          }
        }
      } catch (err) {
        // Fallback: probe drive letters E: through Z:
        for (const letter of ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'U']) {
          const driveLetter = `${letter}:`;
          const mountPath = `${driveLetter}\\`;
          try {
            await fs.promises.access(mountPath, fs.constants.R_OK | fs.constants.W_OK);
            volumes.push({
              driveLetter,
              mountPath,
              label: `Drive (${driveLetter})`,
              totalSpace: 64 * 1024 * 1024 * 1024,
              freeSpace: 32 * 1024 * 1024 * 1024,
              isRemovable: true,
            });
          } catch {
            // Drive not available
          }
        }
      }
    } else {
      // macOS / Linux volume scanning
      const checkDirs = ['/Volumes', '/media', '/mnt'];
      for (const base of checkDirs) {
        try {
          const entries = await fs.promises.readdir(base, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const mountPath = path.join(base, entry.name);
              volumes.push({
                driveLetter: entry.name,
                mountPath,
                label: entry.name,
                totalSpace: 32 * 1024 * 1024 * 1024,
                freeSpace: 16 * 1024 * 1024 * 1024,
                isRemovable: true,
              });
            }
          }
        } catch {
          // ignore
        }
      }
    }

    return volumes;
  }

  /**
   * Filters tracks based on the sync scope.
   */
  filterTracksByScope(
    sourceTracks: Track[],
    scope: 'all' | 'playlists' | 'albums',
    selectedPlaylists?: Playlist[],
    selectedAlbums?: string[]
  ): Track[] {
    if (scope === 'all') {
      return sourceTracks.filter(t => !t.isCorrupt);
    }

    if (scope === 'albums' && selectedAlbums && selectedAlbums.length > 0) {
      const albumSet = new Set(selectedAlbums.map(a => a.toLowerCase()));
      return sourceTracks.filter(t => !t.isCorrupt && t.album && albumSet.has(t.album.toLowerCase()));
    }

    if (scope === 'playlists' && selectedPlaylists && selectedPlaylists.length > 0) {
      const trackIdSet = new Set<string>();
      for (const pl of selectedPlaylists) {
        for (const tid of pl.trackIds) {
          trackIdSet.add(tid);
        }
      }
      return sourceTracks.filter(t => !t.isCorrupt && (trackIdSet.has(t.id) || trackIdSet.has(t.filePath)));
    }

    return sourceTracks.filter(t => !t.isCorrupt);
  }

  /**
   * Analyzes destination USB storage against source tracks and generates an incremental SyncPlan.
   */
  async analyzeSync(options: {
    sourceTracks: Track[];
    targetVolumePath: string;
    scope: 'all' | 'playlists' | 'albums';
    selectedPlaylists?: Playlist[];
    selectedAlbums?: string[];
  }): Promise<SyncPlan> {
    const targetTracks = this.filterTracksByScope(
      options.sourceTracks,
      options.scope,
      options.selectedPlaylists,
      options.selectedAlbums
    );

    const items: SyncPlanItem[] = [];
    const activeTargetPaths = new Set<string>();
    let totalBytesToTransfer = 0;
    let totalFilesToTransfer = 0;

    for (const track of targetTracks) {
      const targetRel = getCarRelativePath(track);
      activeTargetPaths.add(targetRel.toLowerCase());

      const fullTargetPath = path.join(options.targetVolumePath, targetRel);
      let action: 'add' | 'update' | 'keep' = 'add';
      let destSize: number | undefined = undefined;
      let destMtime: number | undefined = undefined;

      try {
        const destStat = await fs.promises.stat(fullTargetPath);
        destSize = destStat.size;
        destMtime = destStat.mtimeMs;

        // Compare file size and mtime (allow 2s tolerance for FAT32 2-second timestamp resolution)
        const sizeDiff = Math.abs(track.fileSize - destStat.size);
        const timeDiff = Math.abs(track.mtime - destStat.mtimeMs);

        if (sizeDiff === 0 && timeDiff <= 2000) {
          action = 'keep';
        } else {
          action = 'update';
        }
      } catch {
        // File does not exist
        action = 'add';
      }

      if (action === 'add' || action === 'update') {
        totalBytesToTransfer += track.fileSize;
        totalFilesToTransfer++;
      }

      items.push({
        track,
        action,
        targetRelativePath: targetRel,
        sourceSize: track.fileSize,
        sourceMtime: track.mtime,
        destSize,
        destMtime,
      });
    }

    // Scan target directory for existing audio files to detect stale files
    const staleFiles: string[] = [];
    await this.findStaleFiles(options.targetVolumePath, options.targetVolumePath, activeTargetPaths, staleFiles);

    return {
      items,
      staleFiles,
      totalBytesToTransfer,
      totalFilesToTransfer,
    };
  }

  /**
   * Recursively scans target drive for audio files not in active target paths.
   */
  private async findStaleFiles(
    baseDir: string,
    currentDir: string,
    activePathsLower: Set<string>,
    staleList: string[]
  ): Promise<void> {
    try {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          // Avoid hidden directories
          if (!entry.name.startsWith('.')) {
            await this.findStaleFiles(baseDir, fullPath, activePathsLower, staleList);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.mp3' || ext === '.flac') {
            if (!activePathsLower.has(relPath.toLowerCase())) {
              staleList.push(relPath);
            }
          }
        }
      }
    } catch {
      // Ignore inaccessible folders
    }
  }

  /**
   * Executes the sync plan: copies missing/updated files and deletes stale files if requested.
   */
  async executeSync(options: {
    plan: SyncPlan;
    targetVolumePath: string;
    pruneStale: boolean;
    selectedPlaylists?: Playlist[];
    onProgress?: (progress: SyncProgress) => void;
  }): Promise<{ success: boolean; copied: number; deleted: number; errors: string[] }> {
    let copied = 0;
    let deleted = 0;
    const errors: string[] = [];
    let bytesDone = 0;

    const filesToCopy = options.plan.items.filter(i => i.action === 'add' || i.action === 'update');
    const totalFiles = filesToCopy.length;
    const totalBytes = options.plan.totalBytesToTransfer;

    // 1. Copy modified and new tracks
    for (const item of filesToCopy) {
      const fullDestPath = path.join(options.targetVolumePath, item.targetRelativePath);
      const destDir = path.dirname(fullDestPath);

      try {
        await fs.promises.mkdir(destDir, { recursive: true });
        await fs.promises.copyFile(item.track.filePath, fullDestPath);

        // Preserve modification time
        const atime = new Date();
        const mtime = new Date(item.track.mtime);
        await fs.promises.utimes(fullDestPath, atime, mtime);

        copied++;
        bytesDone += item.track.fileSize;

        if (options.onProgress) {
          options.onProgress({
            filesDone: copied,
            totalFiles,
            bytesDone,
            totalBytes,
            currentFile: item.targetRelativePath,
          });
        }
      } catch (err: any) {
        errors.push(`Failed to copy ${item.track.filePath} -> ${item.targetRelativePath}: ${err.message}`);
      }
    }

    // 2. Prune stale files if requested
    if (options.pruneStale && options.plan.staleFiles.length > 0) {
      for (const staleRel of options.plan.staleFiles) {
        const fullStalePath = path.join(options.targetVolumePath, staleRel);
        try {
          await fs.promises.unlink(fullStalePath);
          deleted++;
        } catch (err: any) {
          errors.push(`Failed to delete stale file ${staleRel}: ${err.message}`);
        }
      }
    }

    // 3. Export active playlists if any
    if (options.selectedPlaylists && options.selectedPlaylists.length > 0) {
      for (const pl of options.selectedPlaylists) {
        const plTracks = options.plan.items
          .filter(i => pl.trackIds.includes(i.track.id) || pl.trackIds.includes(i.track.filePath))
          .map(i => i.track);

        if (plTracks.length > 0) {
          try {
            await PlaylistExporterService.exportPlaylist({
              playlistName: pl.name,
              tracks: plTracks,
              targetDir: options.targetVolumePath,
              useCarPathStructure: true,
            });
          } catch (err: any) {
            errors.push(`Failed to export playlist ${pl.name}: ${err.message}`);
          }
        }
      }
    }

    return {
      success: errors.length === 0,
      copied,
      deleted,
      errors,
    };
  }
}
