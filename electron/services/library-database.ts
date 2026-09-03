import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Track, AudioFormat } from '../../src/models/types';

// Safe resolution for node:sqlite built-in across CommonJS & ESM (vitest)
let DatabaseSyncClass: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sqlite = require('node:sqlite');
  if (sqlite && sqlite.DatabaseSync) {
    DatabaseSyncClass = sqlite.DatabaseSync;
  }
} catch {
  try {
    const { createRequire } = require('module');
    const req = createRequire(__filename);
    const sqlite = req('node:sqlite');
    if (sqlite && sqlite.DatabaseSync) {
      DatabaseSyncClass = sqlite.DatabaseSync;
    }
  } catch {
    // node:sqlite not present on legacy runtimes (e.g. Electron 33 / Node 20)
  }
}

export interface DatabaseStats {
  trackCount: number;
  artistCount: number;
  albumCount: number;
  corruptCount: number;
}

export class LibraryDatabaseService {
  private db: any = null;
  private dbPath: string;
  private diskCachePath: string;
  private fallbackStore: Map<string, Track> = new Map();

  constructor(customDbPath?: string) {
    let userDataDir: string;
    try {
      userDataDir = typeof app !== 'undefined' && app?.getPath
        ? app.getPath('userData')
        : path.join(process.cwd(), '.config');
    } catch {
      userDataDir = path.join(process.cwd(), '.config');
    }

    if (customDbPath) {
      this.dbPath = customDbPath;
      this.diskCachePath = customDbPath === ':memory:' ? ':memory:' : `${customDbPath}.cache.json`;
    } else {
      this.dbPath = path.join(userDataDir, 'library.db');
      this.diskCachePath = path.join(userDataDir, 'library-cache.json');
    }

    if (DatabaseSyncClass) {
      try {
        const dir = path.dirname(this.dbPath);
        if (this.dbPath !== ':memory:' && !fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new DatabaseSyncClass(this.dbPath);
        this.initSchema();
      } catch (err) {
        console.warn('SQLite initialization fallback to disk-backed store:', err);
        this.db = null;
      }
    }

    // If SQLite native is unavailable (e.g. Electron Node 20), initialize persistent disk store
    if (!this.db && this.diskCachePath !== ':memory:') {
      this.loadDiskCache();
    }
  }

  getDbPath(): string {
    return this.dbPath;
  }

  isSqliteActive(): boolean {
    return this.db !== null;
  }

  private loadDiskCache(): void {
    try {
      if (fs.existsSync(this.diskCachePath)) {
        const raw = fs.readFileSync(this.diskCachePath, 'utf-8');
        const list = JSON.parse(raw) as Track[];
        if (Array.isArray(list)) {
          this.fallbackStore.clear();
          for (const track of list) {
            if (track && track.filePath) {
              this.fallbackStore.set(track.filePath, track);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load disk cache from', this.diskCachePath, err);
    }
  }

  private flushDiskCache(): void {
    if (this.diskCachePath === ':memory:') return;
    try {
      const dir = path.dirname(this.diskCachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = JSON.stringify(Array.from(this.fallbackStore.values()));
      const tempPath = `${this.diskCachePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, data, 'utf-8');
      fs.renameSync(tempPath, this.diskCachePath);
    } catch (err) {
      console.error('Failed to flush library cache to disk:', err);
    }
  }

  private initSchema(): void {
    if (!this.db) return;

    if (this.dbPath !== ':memory:') {
      try {
        this.db.exec('PRAGMA journal_mode = WAL;');
        this.db.exec('PRAGMA synchronous = NORMAL;');
      } catch {
        // pragma failures on non-standard fs are ignored
      }
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        file_path TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT NOT NULL,
        album_artist TEXT,
        track_number INTEGER,
        total_tracks INTEGER,
        disc_number INTEGER,
        total_discs INTEGER,
        year INTEGER,
        genre TEXT,
        duration REAL NOT NULL DEFAULT 0,
        bitrate INTEGER,
        sample_rate INTEGER,
        bits_per_sample INTEGER,
        codec TEXT,
        format TEXT NOT NULL DEFAULT 'mp3',
        file_size INTEGER NOT NULL DEFAULT 0,
        mtime INTEGER NOT NULL DEFAULT 0,
        is_corrupt INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tracks_file_path ON tracks(file_path);
      CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
      CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
      CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
      CREATE INDEX IF NOT EXISTS idx_tracks_mtime ON tracks(mtime);
    `);

    // Ensure columns exist on legacy databases
    try {
      this.db.exec('ALTER TABLE tracks ADD COLUMN bits_per_sample INTEGER;');
    } catch {
      // Column already exists
    }
    try {
      this.db.exec('ALTER TABLE tracks ADD COLUMN codec TEXT;');
    } catch {
      // Column already exists
    }
  }

  getAllTracks(): Track[] {
    if (this.db) {
      const stmt = this.db.prepare(`
        SELECT 
          id,
          file_path as filePath,
          title,
          artist,
          album,
          album_artist as albumArtist,
          track_number as trackNumber,
          total_tracks as totalTracks,
          disc_number as discNumber,
          total_discs as totalDiscs,
          year,
          genre,
          duration,
          bitrate,
          sample_rate as sampleRate,
          bits_per_sample as bitsPerSample,
          codec,
          format,
          file_size as fileSize,
          mtime,
          is_corrupt as isCorrupt
        FROM tracks
        ORDER BY artist COLLATE NOCASE ASC, album COLLATE NOCASE ASC, track_number ASC
      `);

      const rows = stmt.all() as any[];
      return rows.map(r => ({
        id: r.id,
        filePath: r.filePath,
        title: r.title,
        artist: r.artist,
        album: r.album,
        albumArtist: r.albumArtist || undefined,
        trackNumber: r.trackNumber !== null && r.trackNumber !== undefined ? Number(r.trackNumber) : undefined,
        totalTracks: r.totalTracks !== null && r.totalTracks !== undefined ? Number(r.totalTracks) : undefined,
        discNumber: r.discNumber !== null && r.discNumber !== undefined ? Number(r.discNumber) : undefined,
        totalDiscs: r.totalDiscs !== null && r.totalDiscs !== undefined ? Number(r.totalDiscs) : undefined,
        year: r.year !== null && r.year !== undefined ? Number(r.year) : undefined,
        genre: r.genre || undefined,
        duration: Number(r.duration || 0),
        bitrate: r.bitrate !== null && r.bitrate !== undefined ? Number(r.bitrate) : undefined,
        sampleRate: r.sampleRate !== null && r.sampleRate !== undefined ? Number(r.sampleRate) : undefined,
        bitsPerSample: r.bitsPerSample !== null && r.bitsPerSample !== undefined ? Number(r.bitsPerSample) : undefined,
        codec: r.codec || undefined,
        format: (r.format || 'mp3') as AudioFormat,
        fileSize: Number(r.fileSize || 0),
        mtime: Number(r.mtime || 0),
        isCorrupt: Boolean(r.isCorrupt),
      }));
    }

    return Array.from(this.fallbackStore.values()).sort((a, b) =>
      a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album) || (a.trackNumber || 0) - (b.trackNumber || 0)
    );
  }

  getTracksMtimeMap(): Map<string, { mtime: number; fileSize: number; isCorrupt: boolean }> {
    if (this.db) {
      const stmt = this.db.prepare('SELECT file_path as filePath, mtime, file_size as fileSize, is_corrupt as isCorrupt FROM tracks');
      const rows = stmt.all() as any[];
      const map = new Map<string, { mtime: number; fileSize: number; isCorrupt: boolean }>();
      for (const r of rows) {
        map.set(r.filePath, {
          mtime: Number(r.mtime || 0),
          fileSize: Number(r.fileSize || 0),
          isCorrupt: Boolean(r.isCorrupt),
        });
      }
      return map;
    }

    const map = new Map<string, { mtime: number; fileSize: number; isCorrupt: boolean }>();
    for (const [p, t] of this.fallbackStore.entries()) {
      map.set(p, {
        mtime: t.mtime,
        fileSize: t.fileSize,
        isCorrupt: Boolean(t.isCorrupt),
      });
    }
    return map;
  }

  getTrackByPath(filePath: string): Track | null {
    if (this.db) {
      const stmt = this.db.prepare(`
        SELECT 
          id,
          file_path as filePath,
          title,
          artist,
          album,
          album_artist as albumArtist,
          track_number as trackNumber,
          total_tracks as totalTracks,
          disc_number as discNumber,
          total_discs as totalDiscs,
          year,
          genre,
          duration,
          bitrate,
          sample_rate as sampleRate,
          bits_per_sample as bitsPerSample,
          codec,
          format,
          file_size as fileSize,
          mtime,
          is_corrupt as isCorrupt
        FROM tracks
        WHERE file_path = ?
      `);

      const r = stmt.get(filePath) as any;
      if (!r) return null;

      return {
        id: r.id,
        filePath: r.filePath,
        title: r.title,
        artist: r.artist,
        album: r.album,
        albumArtist: r.albumArtist || undefined,
        trackNumber: r.trackNumber !== null && r.trackNumber !== undefined ? Number(r.trackNumber) : undefined,
        totalTracks: r.totalTracks !== null && r.totalTracks !== undefined ? Number(r.totalTracks) : undefined,
        discNumber: r.discNumber !== null && r.discNumber !== undefined ? Number(r.discNumber) : undefined,
        totalDiscs: r.totalDiscs !== null && r.totalDiscs !== undefined ? Number(r.totalDiscs) : undefined,
        year: r.year !== null && r.year !== undefined ? Number(r.year) : undefined,
        genre: r.genre || undefined,
        duration: Number(r.duration || 0),
        bitrate: r.bitrate !== null && r.bitrate !== undefined ? Number(r.bitrate) : undefined,
        sampleRate: r.sampleRate !== null && r.sampleRate !== undefined ? Number(r.sampleRate) : undefined,
        bitsPerSample: r.bitsPerSample !== null && r.bitsPerSample !== undefined ? Number(r.bitsPerSample) : undefined,
        codec: r.codec || undefined,
        format: (r.format || 'mp3') as AudioFormat,
        fileSize: Number(r.fileSize || 0),
        mtime: Number(r.mtime || 0),
        isCorrupt: Boolean(r.isCorrupt),
      };
    }

    return this.fallbackStore.get(filePath) || null;
  }

  upsertTrack(track: Track): void {
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT INTO tracks (
          id, file_path, title, artist, album, album_artist,
          track_number, total_tracks, disc_number, total_discs,
          year, genre, duration, bitrate, sample_rate,
          bits_per_sample, codec,
          format, file_size, mtime, is_corrupt, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?
        )
        ON CONFLICT(file_path) DO UPDATE SET
          id = excluded.id,
          title = excluded.title,
          artist = excluded.artist,
          album = excluded.album,
          album_artist = excluded.album_artist,
          track_number = excluded.track_number,
          total_tracks = excluded.total_tracks,
          disc_number = excluded.disc_number,
          total_discs = excluded.total_discs,
          year = excluded.year,
          genre = excluded.genre,
          duration = excluded.duration,
          bitrate = excluded.bitrate,
          sample_rate = excluded.sample_rate,
          bits_per_sample = excluded.bits_per_sample,
          codec = excluded.codec,
          format = excluded.format,
          file_size = excluded.file_size,
          mtime = excluded.mtime,
          is_corrupt = excluded.is_corrupt,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        track.id,
        track.filePath,
        track.title,
        track.artist,
        track.album,
        track.albumArtist ?? null,
        track.trackNumber ?? null,
        track.totalTracks ?? null,
        track.discNumber ?? null,
        track.totalDiscs ?? null,
        track.year ?? null,
        track.genre ?? null,
        track.duration,
        track.bitrate ?? null,
        track.sampleRate ?? null,
        track.bitsPerSample ?? null,
        track.codec ?? null,
        track.format,
        track.fileSize,
        track.mtime,
        track.isCorrupt ? 1 : 0,
        Date.now()
      );
      return;
    }

    this.fallbackStore.set(track.filePath, track);
    this.flushDiskCache();
  }

  upsertTracks(tracks: Track[]): void {
    if (tracks.length === 0) return;

    if (this.db) {
      this.db.exec('BEGIN TRANSACTION;');
      try {
        const stmt = this.db.prepare(`
          INSERT INTO tracks (
            id, file_path, title, artist, album, album_artist,
            track_number, total_tracks, disc_number, total_discs,
            year, genre, duration, bitrate, sample_rate,
            bits_per_sample, codec,
            format, file_size, mtime, is_corrupt, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?, ?
          )
          ON CONFLICT(file_path) DO UPDATE SET
            id = excluded.id,
            title = excluded.title,
            artist = excluded.artist,
            album = excluded.album,
            album_artist = excluded.album_artist,
            track_number = excluded.track_number,
            total_tracks = excluded.total_tracks,
            disc_number = excluded.disc_number,
            total_discs = excluded.total_discs,
            year = excluded.year,
            genre = excluded.genre,
            duration = excluded.duration,
            bitrate = excluded.bitrate,
            sample_rate = excluded.sample_rate,
            bits_per_sample = excluded.bits_per_sample,
            codec = excluded.codec,
            format = excluded.format,
            file_size = excluded.file_size,
            mtime = excluded.mtime,
            is_corrupt = excluded.is_corrupt,
            updated_at = excluded.updated_at
        `);

        const now = Date.now();
        for (const t of tracks) {
          stmt.run(
            t.id,
            t.filePath,
            t.title,
            t.artist,
            t.album,
            t.albumArtist ?? null,
            t.trackNumber ?? null,
            t.totalTracks ?? null,
            t.discNumber ?? null,
            t.totalDiscs ?? null,
            t.year ?? null,
            t.genre ?? null,
            t.duration,
            t.bitrate ?? null,
            t.sampleRate ?? null,
            t.bitsPerSample ?? null,
            t.codec ?? null,
            t.format,
            t.fileSize,
            t.mtime,
            t.isCorrupt ? 1 : 0,
            now
          );
        }
        this.db.exec('COMMIT;');
      } catch (err) {
        this.db.exec('ROLLBACK;');
        throw err;
      }
      return;
    }

    for (const t of tracks) {
      this.fallbackStore.set(t.filePath, t);
    }
    this.flushDiskCache();
  }

  deleteTracksByPaths(filePaths: string[]): void {
    if (filePaths.length === 0) return;

    if (this.db) {
      this.db.exec('BEGIN TRANSACTION;');
      try {
        const stmt = this.db.prepare('DELETE FROM tracks WHERE file_path = ?');
        for (const p of filePaths) {
          stmt.run(p);
        }
        this.db.exec('COMMIT;');
      } catch (err) {
        this.db.exec('ROLLBACK;');
        throw err;
      }
      return;
    }

    for (const p of filePaths) {
      this.fallbackStore.delete(p);
    }
    this.flushDiskCache();
  }

  clearLibrary(): void {
    if (this.db) {
      this.db.exec('DELETE FROM tracks;');
      return;
    }
    this.fallbackStore.clear();
    this.flushDiskCache();
  }

  getStats(): DatabaseStats {
    if (this.db) {
      const countStmt = this.db.prepare(`
        SELECT 
          COUNT(*) as trackCount,
          COUNT(DISTINCT artist) as artistCount,
          COUNT(DISTINCT album) as albumCount,
          SUM(CASE WHEN is_corrupt = 1 THEN 1 ELSE 0 END) as corruptCount
        FROM tracks
      `);
      const r = countStmt.get() as any;
      return {
        trackCount: Number(r?.trackCount || 0),
        artistCount: Number(r?.artistCount || 0),
        albumCount: Number(r?.albumCount || 0),
        corruptCount: Number(r?.corruptCount || 0),
      };
    }

    const all = Array.from(this.fallbackStore.values());
    const artists = new Set(all.map(t => t.artist));
    const albums = new Set(all.map(t => t.album));
    const corrupt = all.filter(t => t.isCorrupt).length;
    return {
      trackCount: all.length,
      artistCount: artists.size,
      albumCount: albums.size,
      corruptCount: corrupt,
    };
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
