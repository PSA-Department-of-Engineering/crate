import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Track } from '../../src/models/types';

// Safe resolution for node:sqlite built-in across CommonJS & ESM (vitest)
let DatabaseSyncClass: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DatabaseSyncClass = require('node:sqlite').DatabaseSync;
} catch {
  try {
    const { createRequire } = require('module');
    DatabaseSyncClass = createRequire(__filename)('node:sqlite').DatabaseSync;
  } catch (e) {
    console.error('Failed to load node:sqlite:', e);
  }
}

export interface DatabaseStats {
  trackCount: number;
  artistCount: number;
  albumCount: number;
  corruptCount: number;
}

export class LibraryDatabaseService {
  private db: any;
  private dbPath: string;

  constructor(customDbPath?: string) {
    if (customDbPath) {
      this.dbPath = customDbPath;
    } else {
      try {
        const userDataDir = typeof app !== 'undefined' && app?.getPath
          ? app.getPath('userData')
          : path.join(process.cwd(), '.config');
        this.dbPath = path.join(userDataDir, 'library.db');
      } catch {
        this.dbPath = path.join(process.cwd(), '.config', 'library.db');
      }
    }

    const dir = path.dirname(this.dbPath);
    if (this.dbPath !== ':memory:' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSyncClass(this.dbPath);
    this.initSchema();
  }

  getDbPath(): string {
    return this.dbPath;
  }

  private initSchema(): void {
    if (this.dbPath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
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
  }

  getAllTracks(): Track[] {
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
      format: (r.format || 'mp3') as 'mp3' | 'flac',
      fileSize: Number(r.fileSize || 0),
      mtime: Number(r.mtime || 0),
      isCorrupt: Boolean(r.isCorrupt),
    }));
  }

  getTracksMtimeMap(): Map<string, { mtime: number; fileSize: number; isCorrupt: boolean }> {
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

  getTrackByPath(filePath: string): Track | null {
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
      format: (r.format || 'mp3') as 'mp3' | 'flac',
      fileSize: Number(r.fileSize || 0),
      mtime: Number(r.mtime || 0),
      isCorrupt: Boolean(r.isCorrupt),
    };
  }

  upsertTrack(track: Track): void {
    const stmt = this.db.prepare(`
      INSERT INTO tracks (
        id, file_path, title, artist, album, album_artist,
        track_number, total_tracks, disc_number, total_discs,
        year, genre, duration, bitrate, sample_rate,
        format, file_size, mtime, is_corrupt, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
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
      track.format,
      track.fileSize,
      track.mtime,
      track.isCorrupt ? 1 : 0,
      Date.now()
    );
  }

  upsertTracks(tracks: Track[]): void {
    if (tracks.length === 0) return;

    this.db.exec('BEGIN TRANSACTION;');
    try {
      const stmt = this.db.prepare(`
        INSERT INTO tracks (
          id, file_path, title, artist, album, album_artist,
          track_number, total_tracks, disc_number, total_discs,
          year, genre, duration, bitrate, sample_rate,
          format, file_size, mtime, is_corrupt, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
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
  }

  deleteTracksByPaths(filePaths: string[]): void {
    if (filePaths.length === 0) return;

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
  }

  clearLibrary(): void {
    this.db.exec('DELETE FROM tracks;');
  }

  getStats(): DatabaseStats {
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

  close(): void {
    this.db.close();
  }
}
