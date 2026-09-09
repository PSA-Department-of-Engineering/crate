import * as fs from 'fs';
import * as path from 'path';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { Track, Playlist, VolumeInfo, SyncPlan, SyncPlanItem, SyncProgress, AudioFormat } from '../../src/models/types';
import { getCarRelativePath } from './file-organizer';
import { isCarIncompatibleWav } from '../../src/utils/audio-compat';
import { PlaylistExporterService } from './playlist-exporter';

const execAsync = promisify(exec);
// execFile for ffmpeg: args go as an array rather than through cmd.exe, so a
// '%' or '&' in a track filename cannot reach the shell. The PowerShell volume
// query above still needs the shell form.
const execFileAsync = promisify(execFile);

/**
 * FFmpeg arguments converting a car-incompatible WAV to 16-bit FLAC.
 *
 * Writes to the destination only — the WAV master on the PC is never modified.
 * Reducing 32-bit float to 16-bit is a depth reduction, so it is dithered;
 * truncating instead leaves quantisation distortion in quiet passages.
 */
export function buildWavToFlacArgs(sourcePath: string, destPath: string): string[] {
  return [
    '-y',
    '-i', sourcePath,
    '-map', '0:a',
    '-map_metadata', '0',
    '-af', 'aresample=osf=s16:dither_method=triangular',
    '-c:a', 'flac',
    '-f', 'flac',
    destPath,
  ];
}

export interface CrateSyncManifestEntry {
  sourcePath: string;
  sourceMtime: number;
  sourceSize: number;
  targetRelativePath: string;
  format: string;
  transcoded?: boolean;
  syncedAt: number;
}

export interface CrateSyncManifest {
  version: string;
  lastSyncedAt: number;
  files: Record<string, CrateSyncManifestEntry>;
}

export function getFfmpegPath(): string {
  if (typeof process !== 'undefined' && (process as any).resourcesPath) {
    const packagedPath = path.join((process as any).resourcesPath, 'ffmpeg.exe');
    if (fs.existsSync(packagedPath)) {
      return packagedPath;
    }
  }
  try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && typeof ffmpegStatic === 'string' && fs.existsSync(ffmpegStatic)) {
      return ffmpegStatic;
    }
  } catch {}
  return 'ffmpeg';
}

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
      // Non-Windows fallback (Linux/macOS)
      volumes.push({
        driveLetter: '/Volumes/USB',
        mountPath: '/Volumes/USB',
        label: 'USB Drive',
        totalSpace: 32 * 1024 * 1024 * 1024,
        freeSpace: 16 * 1024 * 1024 * 1024,
        isRemovable: true,
      });
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
   * Leverages .crate-sync.json manifest for instant delta sync and tracks 32-bit float WAV transcoding.
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

    // Read destination .crate-sync.json manifest if present
    const manifestPath = path.join(options.targetVolumePath, '.crate-sync.json');
    let manifest: CrateSyncManifest | null = null;
    try {
      if (fs.existsSync(manifestPath)) {
        const raw = await fs.promises.readFile(manifestPath, 'utf-8');
        manifest = JSON.parse(raw);
      }
    } catch {
      manifest = null;
    }

    const items: SyncPlanItem[] = [];
    const activeTargetPaths = new Set<string>();
    let totalBytesToTransfer = 0;
    let totalFilesToTransfer = 0;

    for (const track of targetTracks) {
      // Car head units cannot decode high-bit-depth WAV, so those are converted
      // to 16-bit FLAC on the way to the drive. The library master is never
      // touched: the conversion output goes to the destination path only.
      const needsTranscode = isCarIncompatibleWav(track);

      const targetFormat: AudioFormat = needsTranscode ? 'flac' : track.format;
      const targetRel = getCarRelativePath(track, { targetFormat });
      activeTargetPaths.add(targetRel.toLowerCase());

      const fullTargetPath = path.join(options.targetVolumePath, targetRel);
      let action: 'add' | 'update' | 'keep' = 'add';
      let destSize: number | undefined = undefined;
      let destMtime: number | undefined = undefined;

      // Check against manifest first
      const manifestEntry = manifest?.files ? manifest.files[targetRel.toLowerCase()] : undefined;
      if (manifestEntry) {
        if (
          manifestEntry.sourceMtime === track.mtime &&
          manifestEntry.sourceSize === track.fileSize
        ) {
          try {
            const destStat = await fs.promises.stat(fullTargetPath);
            destSize = destStat.size;
            destMtime = destStat.mtimeMs;
            action = 'keep';
          } catch {
            action = 'add';
          }
        }
      }

      if (action !== 'keep') {
        try {
          const destStat = await fs.promises.stat(fullTargetPath);
          destSize = destStat.size;
          destMtime = destStat.mtimeMs;

          // Allow 2s tolerance throughout for FAT32's 2-second timestamp resolution.
          const timeDiff = Math.abs(track.mtime - destStat.mtimeMs);

          if (!needsTranscode) {
            // Compare file size and mtime
            const sizeDiff = Math.abs(track.fileSize - destStat.size);

            if (sizeDiff === 0 && timeDiff <= 2000) {
              action = 'keep';
            } else {
              action = 'update';
            }
          } else {
            // A transcoded file is a different encoding of its source, so its
            // size will never match the WAV's and size comparison says nothing.
            // mtime carries the identity instead: executeSync stamps every
            // destination with its source's mtime, transcoded ones included. So
            // an unchanged WAV whose FLAC is already on the drive is kept even
            // when the manifest is missing — which is the case that used to
            // re-encode the entire WAV collection on every sync.
            action = timeDiff <= 2000 ? 'keep' : 'update';
          }
        } catch {
          // File does not exist
          action = 'add';
        }
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
        needsTranscode,
        targetFormat,
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
          const lowerName = entry.name.toLowerCase();

          // Exclude manifest file from stale list
          if (lowerName === '.crate-sync.json') {
            continue;
          }

          if (ext === '.mp3' || ext === '.flac' || ext === '.wav') {
            if (!activePathsLower.has(relPath.toLowerCase())) {
              staleList.push(relPath);
            }
          } else if (
            lowerName === 'desktop.ini' ||
            lowerName === 'thumbs.db' ||
            lowerName === '.ds_store' ||
            lowerName.startsWith('._')
          ) {
            staleList.push(relPath);
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

    // 1. Copy or transcode modified and new tracks
    for (const item of filesToCopy) {
      const fullDestPath = path.join(options.targetVolumePath, item.targetRelativePath);
      const destDir = path.dirname(fullDestPath);

      try {
        await fs.promises.mkdir(destDir, { recursive: true });

        if (item.needsTranscode) {
          // Transcode car-incompatible WAV -> 16-bit FLAC using FFmpeg
          const ffmpeg = getFfmpegPath();
          await execFileAsync(ffmpeg, buildWavToFlacArgs(item.track.filePath, fullDestPath));
        } else {
          await fs.promises.copyFile(item.track.filePath, fullDestPath);
        }

        // Preserve modification time
        const atime = new Date();
        const mtime = new Date(item.track.mtime);
        await fs.promises.utimes(fullDestPath, atime, mtime).catch(() => {});

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
        errors.push(`Failed to sync ${item.track.filePath} -> ${item.targetRelativePath}: ${err.message}`);
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

    // 4. Update .crate-sync.json manifest on target volume
    try {
      const manifestPath = path.join(options.targetVolumePath, '.crate-sync.json');
      const manifest: CrateSyncManifest = {
        version: '1.0.0',
        lastSyncedAt: Date.now(),
        files: {},
      };

      try {
        if (fs.existsSync(manifestPath)) {
          const raw = await fs.promises.readFile(manifestPath, 'utf-8');
          const existing = JSON.parse(raw) as CrateSyncManifest;
          if (existing?.files) {
            manifest.files = { ...existing.files };
          }
        }
      } catch {}

      for (const item of options.plan.items) {
        manifest.files[item.targetRelativePath.toLowerCase()] = {
          sourcePath: item.track.filePath,
          sourceMtime: item.track.mtime,
          sourceSize: item.track.fileSize,
          targetRelativePath: item.targetRelativePath,
          format: item.targetFormat || item.track.format,
          transcoded: item.needsTranscode,
          syncedAt: Date.now(),
        };
      }

      if (options.pruneStale && options.plan.staleFiles.length > 0) {
        for (const staleRel of options.plan.staleFiles) {
          delete manifest.files[staleRel.toLowerCase()];
        }
      }

      await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    } catch (err: any) {
      errors.push(`Failed to update .crate-sync.json manifest: ${err.message}`);
    }

    return {
      success: errors.length === 0,
      copied,
      deleted,
      errors,
    };
  }
}
