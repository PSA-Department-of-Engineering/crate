import * as fs from 'fs';
import * as path from 'path';
import { Track } from '../../src/models/types';
import { AudioMetadataService } from './audio-metadata';
import { LibraryDatabaseService } from './library-database';

export class LibraryScannerService {
  private metadataService: AudioMetadataService;
  private dbService?: LibraryDatabaseService;

  constructor(metadataService?: AudioMetadataService, dbService?: LibraryDatabaseService) {
    this.metadataService = metadataService || new AudioMetadataService();
    this.dbService = dbService;
  }

  /**
   * Recursively scans a root directory for MP3 and FLAC files.
   * Leverages SQLite database cache for high performance incremental scans.
   */
  async scanDirectory(
    dirPath: string,
    onProgress?: (scanned: number, currentFile: string) => void
  ): Promise<{ tracks: Track[]; corruptFiles: string[] }> {
    const audioFilePaths: string[] = [];
    await this.collectAudioFiles(dirPath, audioFilePaths);
    const audioPathSet = new Set(audioFilePaths.map(p => path.resolve(p).toLowerCase()));

    // If SQLite database service is available, run high-speed incremental scan
    if (this.dbService) {
      const cachedMtimeMap = this.dbService.getTracksMtimeMap();

      // Find deleted files (files in DB under this dirPath that no longer exist on disk)
      const normalizedDirPath = path.resolve(dirPath).toLowerCase();
      const filesToDelete: string[] = [];
      for (const cachedPath of cachedMtimeMap.keys()) {
        const normalizedCached = path.resolve(cachedPath).toLowerCase();
        if (normalizedCached.startsWith(normalizedDirPath) && !audioPathSet.has(normalizedCached)) {
          filesToDelete.push(cachedPath);
        }
      }
      if (filesToDelete.length > 0) {
        this.dbService.deleteTracksByPaths(filesToDelete);
      }

      // Check which files need scanning (new or modified)
      const filesToScan: string[] = [];
      for (const filePath of audioFilePaths) {
        const cached = cachedMtimeMap.get(filePath);
        if (!cached) {
          filesToScan.push(filePath);
        } else {
          try {
            const stat = await fs.promises.stat(filePath);
            if (Math.floor(stat.mtimeMs) !== Math.floor(cached.mtime) || stat.size !== cached.fileSize) {
              filesToScan.push(filePath);
            }
          } catch {
            filesToScan.push(filePath);
          }
        }
      }

      // Scan only modified/new files
      const scannedTracks: Track[] = [];
      let count = 0;
      for (const filePath of filesToScan) {
        count++;
        if (onProgress) {
          onProgress(count, filePath);
        }

        try {
          const track = await this.metadataService.readTrack(filePath, { skipCovers: true });
          scannedTracks.push(track);
        } catch {
          scannedTracks.push({
            id: filePath,
            filePath,
            title: path.basename(filePath),
            artist: 'Unknown Artist',
            album: 'Unknown Album',
            duration: 0,
            format: filePath.toLowerCase().endsWith('.flac') ? 'flac' : filePath.toLowerCase().endsWith('.wav') ? 'wav' : 'mp3',
            fileSize: 0,
            mtime: Date.now(),
            isCorrupt: true,
          });
        }
      }

      if (scannedTracks.length > 0) {
        this.dbService.upsertTracks(scannedTracks);
      }

      const allTracks = this.dbService.getAllTracks();
      const corruptFiles = allTracks.filter(t => t.isCorrupt).map(t => t.filePath);
      return { tracks: allTracks, corruptFiles };
    }

    const tracks: Track[] = [];
    const corruptFiles: string[] = [];

    let count = 0;
    for (const filePath of audioFilePaths) {
      count++;
      if (onProgress) {
        onProgress(count, filePath);
      }

      try {
        const track = await this.metadataService.readTrack(filePath, { skipCovers: true });
        if (track.isCorrupt) {
          corruptFiles.push(filePath);
        }
        tracks.push(track);
      } catch (err) {
        corruptFiles.push(filePath);
        tracks.push({
          id: filePath,
          filePath,
          title: path.basename(filePath),
          artist: 'Unknown Artist',
          album: 'Unknown Album',
          duration: 0,
          format: filePath.toLowerCase().endsWith('.flac') ? 'flac' : filePath.toLowerCase().endsWith('.wav') ? 'wav' : 'mp3',
          fileSize: 0,
          mtime: Date.now(),
          isCorrupt: true,
        });
      }
    }

    return { tracks, corruptFiles };
  }

  /**
   * Helper to recursively find all .mp3 and .flac files in a directory.
   * Traverses regular directories, symlinks, and NTFS junctions with loop protection.
   */
  private async collectAudioFiles(
    dir: string,
    results: string[],
    visitedDirs: Set<string> = new Set()
  ): Promise<void> {
    try {
      let realDirPath: string;
      try {
        realDirPath = await fs.promises.realpath(dir);
      } catch {
        realDirPath = path.resolve(dir);
      }

      if (visitedDirs.has(realDirPath)) {
        return;
      }
      visitedDirs.add(realDirPath);

      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.collectAudioFiles(fullPath, results, visitedDirs);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.mp3' || ext === '.flac' || ext === '.wav') {
            results.push(fullPath);
          }
        } else if (entry.isSymbolicLink()) {
          try {
            const stat = await fs.promises.stat(fullPath);
            if (stat.isDirectory()) {
              await this.collectAudioFiles(fullPath, results, visitedDirs);
            } else if (stat.isFile()) {
              const ext = path.extname(entry.name).toLowerCase();
              if (ext === '.mp3' || ext === '.flac' || ext === '.wav') {
                results.push(fullPath);
              }
            }
          } catch {
            // Broken symlink or inaccessible target - ignore gracefully
          }
        }
      }
    } catch {
      // Permission errors or inaccessible directories are skipped non-fatally
    }
  }

  /**
   * Search and filter library tracks across artist, album, albumArtist, title, year, genre, trackNumber, and duration.
   */
  static filterTracks(tracks: Track[], query: string): Track[] {
    if (!query || query.trim() === '') {
      return tracks;
    }

    const lowerQuery = query.toLowerCase().trim();

    return tracks.filter(t => {
      if (t.title && t.title.toLowerCase().includes(lowerQuery)) return true;
      if (t.artist && t.artist.toLowerCase().includes(lowerQuery)) return true;
      if (t.album && t.album.toLowerCase().includes(lowerQuery)) return true;
      if (t.albumArtist && t.albumArtist.toLowerCase().includes(lowerQuery)) return true;
      if (t.genre && t.genre.toLowerCase().includes(lowerQuery)) return true;
      if (t.year && t.year.toString().includes(lowerQuery)) return true;
      if (t.trackNumber && t.trackNumber.toString() === lowerQuery) return true;
      if (t.filePath && t.filePath.toLowerCase().includes(lowerQuery)) return true;
      return false;
    });
  }

  /**
   * Sort tracks by field and direction.
   */
  static sortTracks(
    tracks: Track[],
    field: 'artist' | 'album' | 'title' | 'trackNumber' | 'year' | 'genre' | 'duration',
    direction: 'asc' | 'desc' = 'asc'
  ): Track[] {
    const modifier = direction === 'asc' ? 1 : -1;

    return [...tracks].sort((a, b) => {
      let valA: any = a[field];
      let valB: any = b[field];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') {
        return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' }) * modifier;
      }

      if (valA < valB) return -1 * modifier;
      if (valA > valB) return 1 * modifier;
      return 0;
    });
  }
}
