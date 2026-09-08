import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Track, AudioFormat } from '../../src/models/types';

/**
 * Resolution for the node:sqlite built-in across CommonJS & ESM (vitest).
 *
 * This is about *how* to reach the module, not whether to use it. Crate requires
 * node:sqlite (Node 22+); Electron 44 bundles Node 24, and the test runner is
 * Node 22+. There is deliberately no second storage engine: an earlier version
 * fell back to an in-memory Map when node:sqlite was absent, which meant the
 * shipped app (Electron 33 / Node 20) ran a different implementation than the
 * one every test exercised. A missing built-in is now a loud startup failure
 * rather than a silent change of engine.
 */
let DatabaseSyncClass: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DatabaseSyncClass = require('node:sqlite').DatabaseSync;
} catch {
  try {
    const { createRequire } = require('module');
    DatabaseSyncClass = createRequire(__filename)('node:sqlite').DatabaseSync;
  } catch {
    DatabaseSyncClass = null;
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

  constructor(customDbPath?: string) {
    let userDataDir: string;
    try {
      userDataDir = typeof app !== 'undefined' && app?.getPath
        ? app.getPath('userData')
        : path.join(process.cwd(), '.config');
    } catch {
      userDataDir = path.join(process.cwd(), '.config');
    }

    this.dbPath = customDbPath ?? path.join(userDataDir, 'library.db');

    if (!DatabaseSyncClass) {
      throw new Error(
        'Crate requires the node:sqlite built-in module (Node 22 or newer). ' +
          `This runtime (Node ${process.versions.node}) does not provide it.`
      );
    }

    try {
      const dir = path.dirname(this.dbPath);
      if (this.dbPath !== ':memory:' && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new DatabaseSyncClass(this.dbPath);
      this.initSchema();
    } catch (err: any) {
      throw new Error(
        `Failed to open the library database at ${this.dbPath}: ${err?.message || err}`
      );
    }
  }

  getDbPath(): string {
    return this.dbPath;
  }

  isSqliteActive(): boolean {
    return this.db !== null;
  }

  /** Throws rather than silently returning empty results after close(). */
  private requireDb(): any {
    if (!this.db) {
      throw new Error('Library database is not open');
    }
    return this.db;
  }

  private initSchema(): void {
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

  /** Column list shared by the row-returning queries, so they cannot drift. */
  private static readonly TRACK_COLUMNS = `
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
          is_corrupt as isCorrupt`;

  private static rowToTrack(r: any): Track {
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

  getAllTracks(): Track[] {
    const stmt = this.requireDb().prepare(`
        SELECT ${LibraryDatabaseService.TRACK_COLUMNS}
        FROM tracks
        ORDER BY artist COLLATE NOCASE ASC, album COLLATE NOCASE ASC, track_number ASC
      `);

    const rows = stmt.all() as any[];
    return rows.map(LibraryDatabaseService.rowToTrack);
  }

  getTracksMtimeMap(): Map<string, { mtime: number; fileSize: number; isCorrupt: boolean }> {
    const stmt = this.requireDb().prepare(
      'SELECT file_path as filePath, mtime, file_size as fileSize, is_corrupt as isCorrupt FROM tracks'
    );
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
    const stmt = this.requireDb().prepare(`
        SELECT ${LibraryDatabaseService.TRACK_COLUMNS}
        FROM tracks
        WHERE file_path = ?
      `);

    const r = stmt.get(filePath) as any;
    if (!r) return null;

    return LibraryDatabaseService.rowToTrack(r);
  }

  /** Upsert statement shared by the single and batch writers. */
  private static readonly UPSERT_SQL = `
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
      `;

  private static upsertParams(t: Track, now: number): any[] {
    return [
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
      now,
    ];
  }

  upsertTrack(track: Track): void {
    const stmt = this.requireDb().prepare(LibraryDatabaseService.UPSERT_SQL);
    stmt.run(...LibraryDatabaseService.upsertParams(track, Date.now()));
  }

  upsertTracks(tracks: Track[]): void {
    if (tracks.length === 0) return;

    const db = this.requireDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      const stmt = db.prepare(LibraryDatabaseService.UPSERT_SQL);
      const now = Date.now();
      for (const t of tracks) {
        stmt.run(...LibraryDatabaseService.upsertParams(t, now));
      }
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  deleteTracksByPaths(filePaths: string[]): void {
    if (filePaths.length === 0) return;

    const db = this.requireDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      const stmt = db.prepare('DELETE FROM tracks WHERE file_path = ?');
      for (const p of filePaths) {
        stmt.run(p);
      }
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  clearLibrary(): void {
    this.requireDb().exec('DELETE FROM tracks;');
  }

  getStats(): DatabaseStats {
    const countStmt = this.requireDb().prepare(`
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
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
