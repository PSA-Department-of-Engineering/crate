import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import * as mm from 'music-metadata';
import NodeID3 from 'node-id3';
import { Track, TagUpdates, AudioFormat, EmbeddedArtwork } from '../../src/models/types';

interface RawPicture {
  data: Uint8Array;
  format?: string;
  type?: string;
}

/**
 * Identifies a raster image by its magic bytes, independent of any MIME label
 * the tag claims. An APIC/PICTURE payload that is truncated, empty, or not an
 * image at all fails here and is treated as "no embedded art".
 */
function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf[0] === 0x42 && buf[1] === 0x4d) return 'image/bmp';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Sort key so the front cover is tried first when a file carries several pictures. */
function frontCoverRank(pic: RawPicture): number {
  const t = (pic.type || '').toLowerCase();
  if (t.includes('front')) return 0;
  if (t === '' || t.includes('cover')) return 1;
  return 2;
}

/** Sibling image filenames, lower-cased, checked in this order for the sidecar fallback. */
const SIDECAR_ART_BASENAMES = ['cover', 'folder', 'albumart', 'front', 'album'];
const SIDECAR_ART_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
const MAX_ARTWORK_CACHE_BYTES = 32 * 1024 * 1024;
const MAX_ARTWORK_CACHE_ENTRIES = 512;
const MAX_PERSISTENT_ARTWORK_BYTES = 64 * 1024 * 1024;

interface PersistentArtworkRecord {
  fileName: string;
  mime: string | null;
  bytes: number;
  lastAccessed: number;
}

function normalizeProducerValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const values = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    return values.length > 0 ? values.join(', ') : undefined;
  }
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return undefined;
}

/**
 * Producer is represented as a common tag by music-metadata for FLAC and
 * ID3v2.4. NodeID3 writes ID3v2.3 TIPL frames, which music-metadata exposes in
 * native tags rather than promoting to common.producer, so inspect both forms.
 */
function getProducerFromMetadata(metadata: mm.IAudioMetadata): string | undefined {
  const commonProducer = normalizeProducerValue(metadata.common.producer);
  if (commonProducer) return commonProducer;

  for (const tag of Object.values(metadata.native ?? {}).flat()) {
    const id = tag.id.toUpperCase();
    if (id === 'TIPL' || id === 'IPLS') {
      const value = tag.value;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const producer = normalizeProducerValue((value as Record<string, unknown>).producer);
        if (producer) return producer;
      }
    }
  }

  return undefined;
}

interface PersistentArtworkIndex {
  version: 1;
  entries: Record<string, PersistentArtworkRecord>;
}

function toArtworkUri(bytes: Buffer, mime: string): EmbeddedArtwork {
  return { format: mime, data: `data:${mime};base64,${bytes.toString('base64')}` };
}

/** Decodes an artwork payload that may be a `data:` URI or a bare base64 string. */
function dataUriToBuffer(data: string): Buffer {
  const base64 = data.startsWith('data:') ? data.slice(data.indexOf(',') + 1) : data;
  return Buffer.from(base64, 'base64');
}

export class AudioMetadataService {
  private persistentArtworkCacheDir?: string;
  private persistentArtworkIndex = new Map<string, PersistentArtworkRecord>();
  private persistentIndexWrite = Promise.resolve();
  private artworkCache = new Map<string, {
    signature: string;
    artwork: EmbeddedArtwork | null;
    bytes: number;
  }>();
  private artworkRequests = new Map<string, Promise<EmbeddedArtwork | null>>();
  private artworkCacheBytes = 0;

  constructor(persistentArtworkCacheDir?: string) {
    this.persistentArtworkCacheDir = persistentArtworkCacheDir;
    this.loadPersistentArtworkIndex();
  }

  private async readProducerFromFile(filePath: string): Promise<string | undefined> {
    try {
      const metadata = await mm.parseFile(filePath, { duration: false, skipCovers: true });
      return getProducerFromMetadata(metadata);
    } catch {
      return undefined;
    }
  }

  /**
   * Reads metadata from an audio file (.mp3 or .flac) and returns a Track object.
   */
  async readTrack(filePath: string, options: { skipCovers?: boolean } = { skipCovers: true }): Promise<Track> {
    const stats = await fs.promises.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const format: AudioFormat = ext === '.flac' ? 'flac' : ext === '.wav' ? 'wav' : 'mp3';
    const skipCovers = options?.skipCovers ?? true;

    try {
      const metadata = await mm.parseFile(filePath, { duration: true, skipCovers });
      const common = metadata.common;
      const formatInfo = metadata.format;

      let picture: EmbeddedArtwork | undefined = undefined;
      if (!skipCovers) {
        picture = this.pickValidEmbeddedPicture(common.picture) ?? undefined;
      }

      return {
        id: filePath,
        filePath,
        title: common.title || path.basename(filePath, ext),
        artist: common.artist || 'Unknown Artist',
        album: common.album || 'Unknown Album',
        albumArtist: common.albumartist,
        producer: getProducerFromMetadata(metadata),
        trackNumber: common.track.no || undefined,
        totalTracks: common.track.of || undefined,
        discNumber: common.disk.no || undefined,
        totalDiscs: common.disk.of || undefined,
        year: common.year,
        genre: common.genre && common.genre.length > 0 ? common.genre.join(', ') : undefined,
        duration: formatInfo.duration || 0,
        bitrate: formatInfo.bitrate ? Math.round(formatInfo.bitrate / 1000) : undefined,
        sampleRate: formatInfo.sampleRate,
        bitsPerSample: formatInfo.bitsPerSample,
        codec: formatInfo.codec,
        format,
        picture,
        fileSize: stats.size,
        mtime: stats.mtimeMs,
        isCorrupt: false,
      };
    } catch (err) {
      // Return track marked as corrupt
      return {
        id: filePath,
        filePath,
        title: path.basename(filePath, ext),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        duration: 0,
        format,
        fileSize: stats.size,
        mtime: stats.mtimeMs,
        isCorrupt: true,
      };
    }
  }

  /**
   * Reads and extracts artwork on-demand for a single track: a valid embedded
   * picture (front cover preferred) if present, otherwise a sibling
   * cover/folder/albumart image file, otherwise null.
   */
  async getArtwork(filePath: string): Promise<EmbeddedArtwork | null> {
    const signature = await this.getArtworkSourceSignature(filePath);
    const cacheKey = `${filePath}\u0000${signature}`;
    const cached = this.artworkCache.get(cacheKey);
    if (cached) {
      // Map insertion order gives us a small LRU cache without another
      // dependency. Artwork is deliberately capped by bytes, not entries,
      // because embedded covers vary widely in size.
      this.artworkCache.delete(cacheKey);
      this.artworkCache.set(cacheKey, cached);
      return cached.artwork;
    }

    const pending = this.artworkRequests.get(cacheKey);
    if (pending) return pending;

    const request = this.loadPersistentArtwork(cacheKey)
      .then(async (persistent) => {
        if (persistent.hit) {
          this.rememberArtwork(filePath, cacheKey, signature, persistent.artwork);
          return persistent.artwork;
        }

        const artwork = await this.loadArtwork(filePath);
        this.rememberArtwork(filePath, cacheKey, signature, artwork);
        void this.persistArtwork(filePath, cacheKey, artwork);
        return artwork;
      })
      .finally(() => {
        this.artworkRequests.delete(cacheKey);
      });

    this.artworkRequests.set(cacheKey, request);
    return request;
  }

  private async loadArtwork(filePath: string): Promise<EmbeddedArtwork | null> {
    try {
      const metadata = await mm.parseFile(filePath, { duration: false, skipCovers: false });
      const embedded = this.pickValidEmbeddedPicture(metadata.common.picture);
      if (embedded) return embedded;
    } catch {
      // Unreadable tags — still try a sidecar image below.
    }
    return this.findSidecarArtwork(filePath);
  }

  /**
   * Changes to either the audio file or a conventional sibling cover must
   * invalidate the in-process result. This keeps tag edits and replaced
   * folder.jpg files visible without rescanning every track's metadata.
   */
  private async getArtworkSourceSignature(filePath: string): Promise<string> {
    let audioSignature = 'audio:missing';
    try {
      const stats = await fs.promises.stat(filePath);
      audioSignature = `audio:${stats.mtimeMs}:${stats.size}`;
    } catch {
      // The loader will return null for a missing file.
    }

    const sidecarSignatures: string[] = [];
    try {
      const dir = path.dirname(filePath);
      const entries = await fs.promises.readdir(dir);
      const byLowerName = new Map(entries.map((entry) => [entry.toLowerCase(), entry]));

      for (const base of SIDECAR_ART_BASENAMES) {
        for (const ext of SIDECAR_ART_EXTS) {
          const actual = byLowerName.get(base + ext);
          if (!actual) continue;

          try {
            const stats = await fs.promises.stat(path.join(dir, actual));
            sidecarSignatures.push(`${actual}:${stats.mtimeMs}:${stats.size}`);
          } catch {
            // A disappearing sidecar is represented by its absence next time.
          }
        }
      }
    } catch {
      // An unreadable directory has no usable sidecar signature.
    }

    return `${audioSignature}|${sidecarSignatures.join('|')}`;
  }

  private rememberArtwork(
    filePath: string,
    cacheKey: string,
    signature: string,
    artwork: EmbeddedArtwork | null
  ): void {
    // Only retain the latest source signature for a file path.
    const filePrefix = `${filePath}\u0000`;
    for (const [key, entry] of this.artworkCache) {
      if (key.startsWith(filePrefix)) {
        this.artworkCache.delete(key);
        this.artworkCacheBytes -= entry.bytes;
      }
    }

    const bytes = artwork?.data ? Buffer.byteLength(artwork.data, 'utf8') : 0;
    this.artworkCache.set(cacheKey, { signature, artwork, bytes });
    this.artworkCacheBytes += bytes;

    while (
      (this.artworkCacheBytes > MAX_ARTWORK_CACHE_BYTES ||
        this.artworkCache.size > MAX_ARTWORK_CACHE_ENTRIES) &&
      this.artworkCache.size > 0
    ) {
      const oldestKey = this.artworkCache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      const oldest = this.artworkCache.get(oldestKey);
      this.artworkCache.delete(oldestKey);
      this.artworkCacheBytes -= oldest?.bytes ?? 0;
    }
  }

  private loadPersistentArtworkIndex(): void {
    if (!this.persistentArtworkCacheDir) return;

    try {
      const indexPath = path.join(this.persistentArtworkCacheDir, 'index.json');
      if (!fs.existsSync(indexPath)) return;

      const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as Partial<PersistentArtworkIndex>;
      if (parsed.version !== 1 || !parsed.entries) return;

      for (const [key, record] of Object.entries(parsed.entries)) {
        if (
          record &&
          typeof record.fileName === 'string' &&
          (typeof record.mime === 'string' || record.mime === null) &&
          typeof record.bytes === 'number' &&
          typeof record.lastAccessed === 'number'
        ) {
          this.persistentArtworkIndex.set(key, record);
        }
      }
    } catch {
      // A corrupt cache is disposable; the source audio remains authoritative.
      this.persistentArtworkIndex.clear();
    }
  }

  private persistentArtworkPath(cacheKey: string): string | undefined {
    if (!this.persistentArtworkCacheDir) return undefined;
    const fileName = `${createHash('sha256').update(cacheKey).digest('hex')}.art`;
    return path.join(this.persistentArtworkCacheDir, fileName);
  }

  private async loadPersistentArtwork(cacheKey: string): Promise<
    | { hit: true; artwork: EmbeddedArtwork | null }
    | { hit: false }
  > {
    if (!this.persistentArtworkCacheDir) return { hit: false };

    const record = this.persistentArtworkIndex.get(cacheKey);
    if (!record) return { hit: false };

    if (record.mime === null) {
      record.lastAccessed = Date.now();
      this.schedulePersistentIndexWrite();
      return { hit: true, artwork: null };
    }

    const cachedPath = this.persistentArtworkPath(cacheKey);
    if (!cachedPath) return { hit: false };

    try {
      const bytes = await fs.promises.readFile(cachedPath);
      record.lastAccessed = Date.now();
      this.schedulePersistentIndexWrite();
      return { hit: true, artwork: toArtworkUri(bytes, record.mime) };
    } catch {
      this.persistentArtworkIndex.delete(cacheKey);
      this.schedulePersistentIndexWrite();
      return { hit: false };
    }
  }

  private async persistArtwork(
    filePath: string,
    cacheKey: string,
    artwork: EmbeddedArtwork | null
  ): Promise<void> {
    if (!this.persistentArtworkCacheDir) return;

    try {
      await fs.promises.mkdir(this.persistentArtworkCacheDir, { recursive: true });

      const fileName = `${createHash('sha256').update(cacheKey).digest('hex')}.art`;
      const cachedPath = path.join(this.persistentArtworkCacheDir, fileName);
      let bytes = 0;

      if (artwork?.data) {
        const imageBytes = dataUriToBuffer(artwork.data);
        bytes = imageBytes.length;
        if (bytes > MAX_PERSISTENT_ARTWORK_BYTES) return;
        await fs.promises.writeFile(cachedPath, imageBytes);
      }

      const filePrefix = `${filePath}\u0000`;
      for (const [oldKey, oldRecord] of this.persistentArtworkIndex) {
        if (oldKey.startsWith(filePrefix) && oldKey !== cacheKey) {
          this.persistentArtworkIndex.delete(oldKey);
          if (oldRecord.mime !== null) {
            const oldPath = this.persistentArtworkPath(oldKey);
            if (oldPath) await fs.promises.rm(oldPath, { force: true }).catch(() => {});
          }
        }
      }

      this.persistentArtworkIndex.set(cacheKey, {
        fileName,
        mime: artwork?.format ?? null,
        bytes,
        lastAccessed: Date.now(),
      });
      await this.prunePersistentArtworkCache();
      this.schedulePersistentIndexWrite();
    } catch {
      // Artwork remains available for the current session even if the cache
      // directory is read-only or the disk fills up.
    }
  }

  private async prunePersistentArtworkCache(): Promise<void> {
    let totalBytes = 0;
    for (const record of this.persistentArtworkIndex.values()) {
      totalBytes += record.bytes;
    }

    if (totalBytes <= MAX_PERSISTENT_ARTWORK_BYTES) return;

    const oldestFirst = Array.from(this.persistentArtworkIndex.entries())
      .filter(([, record]) => record.mime !== null)
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    for (const [key, record] of oldestFirst) {
      if (totalBytes <= MAX_PERSISTENT_ARTWORK_BYTES) break;
      this.persistentArtworkIndex.delete(key);
      totalBytes -= record.bytes;
      const cachedPath = this.persistentArtworkPath(key);
      if (cachedPath) await fs.promises.rm(cachedPath, { force: true }).catch(() => {});
    }
  }

  private schedulePersistentIndexWrite(): void {
    if (!this.persistentArtworkCacheDir) return;

    this.persistentIndexWrite = this.persistentIndexWrite
      .catch(() => {})
      .then(async () => {
        await fs.promises.mkdir(this.persistentArtworkCacheDir!, { recursive: true });
        const index: PersistentArtworkIndex = {
          version: 1,
          entries: Object.fromEntries(this.persistentArtworkIndex),
        };
        await fs.promises.writeFile(
          path.join(this.persistentArtworkCacheDir!, 'index.json'),
          JSON.stringify(index),
          'utf8'
        );
      })
      .catch(() => {
        // Cache writes are best-effort and must never surface as an
        // unhandled rejection in the renderer or during application shutdown.
      });
  }

  private invalidateArtworkCache(filePath: string): void {
    const filePrefix = `${filePath}\u0000`;
    for (const [key, entry] of this.artworkCache) {
      if (key.startsWith(filePrefix)) {
        this.artworkCache.delete(key);
        this.artworkCacheBytes -= entry.bytes;
      }
    }
  }

  private async invalidatePersistentArtworkCache(filePath: string): Promise<void> {
    if (!this.persistentArtworkCacheDir) return;

    const filePrefix = `${filePath}\u0000`;
    for (const [key, record] of this.persistentArtworkIndex) {
      if (key.startsWith(filePrefix)) {
        this.persistentArtworkIndex.delete(key);
        if (record.mime !== null) {
          const cachedPath = this.persistentArtworkPath(key);
          if (cachedPath) await fs.promises.rm(cachedPath, { force: true }).catch(() => {});
        }
      }
    }
    this.schedulePersistentIndexWrite();
  }

  /**
   * Picks the first embedded picture whose bytes are a decodable image, trying
   * the front cover first. The tag's own MIME claim is not trusted: the type is
   * taken from the magic bytes, and a payload that sniffs to nothing is skipped.
   */
  private pickValidEmbeddedPicture(pictures: readonly RawPicture[] | undefined): EmbeddedArtwork | null {
    if (!pictures || pictures.length === 0) return null;
    const ordered = [...pictures].sort((a, b) => frontCoverRank(a) - frontCoverRank(b));
    for (const pic of ordered) {
      const bytes = Buffer.from(pic.data);
      const mime = sniffImageMime(bytes);
      if (mime) return toArtworkUri(bytes, mime);
    }
    return null;
  }

  /**
   * Looks for a loose cover image next to the audio file (cover.jpg, folder.png,
   * albumart.jpg, ...), used when a track carries no usable embedded art.
   */
  private async findSidecarArtwork(audioFilePath: string): Promise<EmbeddedArtwork | null> {
    try {
      const dir = path.dirname(audioFilePath);
      const entries = await fs.promises.readdir(dir);
      const byLowerName = new Map(entries.map(e => [e.toLowerCase(), e]));
      for (const base of SIDECAR_ART_BASENAMES) {
        for (const ext of SIDECAR_ART_EXTS) {
          const actual = byLowerName.get(base + ext);
          if (!actual) continue;
          const bytes = await fs.promises.readFile(path.join(dir, actual));
          const mime = sniffImageMime(bytes);
          if (mime) return toArtworkUri(bytes, mime);
        }
      }
    } catch {
      // Directory unreadable — no sidecar art.
    }
    return null;
  }

  /**
   * Updates tags on an MP3, FLAC, or WAV file on disk without modifying audio
   * stream data. Any other extension throws rather than silently doing nothing.
   */
  async writeTrackTags(
    filePath: string,
    updates: TagUpdates,
    options: { includeArtwork?: boolean } = {}
  ): Promise<Track> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.mp3') {
      await this.writeMp3Tags(filePath, updates);
    } else if (ext === '.flac') {
      await this.writeFlacTags(filePath, updates);
    } else if (ext === '.wav') {
      await this.writeWavTags(filePath, updates);
    } else {
      throw new Error(`Tag editing is not supported for ${ext || 'this file type'}`);
    }

    this.invalidateArtworkCache(filePath);
    await this.invalidatePersistentArtworkCache(filePath);

    // Re-read file to return updated Track model
    return await this.readTrack(filePath, { skipCovers: options.includeArtwork === false });
  }

  /**
   * Writes ID3v2 tags to an MP3 file using NodeID3.
   */
  private async writeMp3Tags(filePath: string, updates: TagUpdates): Promise<void> {
    const existingTags = NodeID3.read(filePath) || {};
    const existingProducer = updates.producer === undefined ? await this.readProducerFromFile(filePath) : undefined;

    const newTags: NodeID3.Tags = { ...existingTags };

    if (updates.title !== undefined) newTags.title = updates.title;
    if (updates.artist !== undefined) newTags.artist = updates.artist;
    if (updates.album !== undefined) newTags.album = updates.album;
    if (updates.albumArtist !== undefined) newTags.performerInfo = updates.albumArtist;
    if (updates.producer !== undefined) {
      newTags.involvedPeopleList = updates.producer.trim()
        ? `producer${String.fromCharCode(0)}${updates.producer.trim()}`
        : undefined;
    } else if (existingProducer) {
      newTags.involvedPeopleList = `producer${String.fromCharCode(0)}${existingProducer}`;
    }
    if (updates.genre !== undefined) newTags.genre = updates.genre;
    if (updates.year !== undefined) newTags.year = updates.year ? `${updates.year}` : undefined;

    if (updates.trackNumber !== undefined || updates.totalTracks !== undefined) {
      const trackNo = updates.trackNumber !== undefined ? updates.trackNumber : (existingTags.trackNumber ? parseInt(existingTags.trackNumber, 10) : undefined);
      const total = updates.totalTracks !== undefined ? updates.totalTracks : undefined;
      newTags.trackNumber = trackNo ? (total ? `${trackNo}/${total}` : `${trackNo}`) : undefined;
    }

    if (updates.discNumber !== undefined || updates.totalDiscs !== undefined) {
      const discNo = updates.discNumber !== undefined ? updates.discNumber : (existingTags.partOfSet ? parseInt(existingTags.partOfSet, 10) : undefined);
      const total = updates.totalDiscs !== undefined ? updates.totalDiscs : undefined;
      newTags.partOfSet = discNo ? (total ? `${discNo}/${total}` : `${discNo}`) : undefined;
    }

    if (updates.picture !== undefined) {
      if (updates.picture === null) {
        delete newTags.image;
      } else {
        let imageBuffer: Buffer;
        if (updates.picture.data.startsWith('data:')) {
          const commaIndex = updates.picture.data.indexOf(',');
          const base64Data = updates.picture.data.slice(commaIndex + 1);
          imageBuffer = Buffer.from(base64Data, 'base64');
        } else {
          imageBuffer = Buffer.from(updates.picture.data, 'base64');
        }

        newTags.image = {
          mime: updates.picture.format || 'image/jpeg',
          type: { id: 3, name: 'front cover' },
          description: 'Cover',
          imageBuffer,
        };
      }
    }

    const success = NodeID3.update(newTags, filePath);
    if (!success) {
      throw new Error(`Failed to update ID3 tags for ${filePath}`);
    }
  }

  /**
   * Updates Vorbis comments and PICTURE blocks for FLAC files.
   */
  private async writeFlacTags(filePath: string, updates: TagUpdates): Promise<void> {
    const fileBuffer = await fs.promises.readFile(filePath);

    // Verify FLAC signature 'fLaC'
    if (fileBuffer.toString('utf-8', 0, 4) !== 'fLaC') {
      throw new Error('Not a valid FLAC file: missing fLaC header');
    }

    // Read metadata blocks
    let offset = 4;
    let isLast = false;
    const blocks: { type: number; isLast: boolean; length: number; start: number; data: Buffer }[] = [];

    while (offset < fileBuffer.length && !isLast) {
      const header = fileBuffer.readUInt8(offset);
      isLast = (header & 0x80) !== 0;
      const type = header & 0x7f;
      const length = (fileBuffer.readUInt8(offset + 1) << 16) |
                     (fileBuffer.readUInt8(offset + 2) << 8) |
                     fileBuffer.readUInt8(offset + 3);

      const blockStart = offset;
      const dataStart = offset + 4;
      const data = fileBuffer.slice(dataStart, dataStart + length);
      blocks.push({ type, isLast, length, start: blockStart, data });

      offset = dataStart + length;
    }

    const audioData = fileBuffer.slice(offset);

    // Find existing VORBIS_COMMENT block (type 4) and PICTURE block (type 6)
    let vorbisBlock = blocks.find(b => b.type === 4);
    let comments: { [key: string]: string[] } = {};
    let vendorString = 'reference libFLAC 1.4.3';

    if (vorbisBlock) {
      const vData = vorbisBlock.data;
      let vOffset = 0;
      const vendorLen = vData.readUInt32LE(vOffset);
      vOffset += 4;
      vendorString = vData.toString('utf-8', vOffset, vOffset + vendorLen);
      vOffset += vendorLen;

      const userCommentListLen = vData.readUInt32LE(vOffset);
      vOffset += 4;

      for (let i = 0; i < userCommentListLen; i++) {
        if (vOffset + 4 > vData.length) break;
        const commentLen = vData.readUInt32LE(vOffset);
        vOffset += 4;
        const comment = vData.toString('utf-8', vOffset, vOffset + commentLen);
        vOffset += commentLen;

        const eqIdx = comment.indexOf('=');
        if (eqIdx !== -1) {
          const key = comment.slice(0, eqIdx).toUpperCase();
          const val = comment.slice(eqIdx + 1);
          if (!comments[key]) comments[key] = [];
          comments[key].push(val);
        }
      }
    }

    // Apply updates to comments map
    if (updates.title !== undefined) comments['TITLE'] = [updates.title];
    if (updates.artist !== undefined) comments['ARTIST'] = [updates.artist];
    if (updates.album !== undefined) comments['ALBUM'] = [updates.album];
    if (updates.albumArtist !== undefined) comments['ALBUMARTIST'] = [updates.albumArtist];
    if (updates.producer !== undefined) comments['PRODUCER'] = [updates.producer];
    if (updates.genre !== undefined) comments['GENRE'] = [updates.genre];
    if (updates.year !== undefined) comments['DATE'] = [updates.year ? `${updates.year}` : ''];
    if (updates.trackNumber !== undefined) comments['TRACKNUMBER'] = [`${updates.trackNumber}`];
    if (updates.totalTracks !== undefined) comments['TRACKTOTAL'] = [`${updates.totalTracks}`];
    if (updates.discNumber !== undefined) comments['DISCNUMBER'] = [`${updates.discNumber}`];
    if (updates.totalDiscs !== undefined) comments['DISCTOTAL'] = [`${updates.totalDiscs}`];

    // Build new Vorbis Comment data buffer
    const commentBuffers: Buffer[] = [];
    let commentCount = 0;
    for (const [k, values] of Object.entries(comments)) {
      for (const val of values) {
        if (val) {
          const str = `${k}=${val}`;
          const strBuf = Buffer.from(str, 'utf-8');
          const lenBuf = Buffer.alloc(4);
          lenBuf.writeUInt32LE(strBuf.length, 0);
          commentBuffers.push(lenBuf, strBuf);
          commentCount++;
        }
      }
    }

    const vendorBuf = Buffer.from(vendorString, 'utf-8');
    const vendorLenBuf = Buffer.alloc(4);
    vendorLenBuf.writeUInt32LE(vendorBuf.length, 0);

    const countBuf = Buffer.alloc(4);
    countBuf.writeUInt32LE(commentCount, 0);

    const newVorbisData = Buffer.concat([vendorLenBuf, vendorBuf, countBuf, ...commentBuffers]);

    // Handle Picture block
    let newPictureData: Buffer | null = null;
    const existingPicBlock = blocks.find(b => b.type === 6);

    if (updates.picture !== undefined) {
      if (updates.picture !== null) {
        let picBytes: Buffer;
        if (updates.picture.data.startsWith('data:')) {
          const comma = updates.picture.data.indexOf(',');
          picBytes = Buffer.from(updates.picture.data.slice(comma + 1), 'base64');
        } else {
          picBytes = Buffer.from(updates.picture.data, 'base64');
        }

        const mime = updates.picture.format || 'image/jpeg';
        const mimeBuf = Buffer.from(mime, 'ascii');
        const descBuf = Buffer.from('Front Cover', 'utf-8');

        // PICTURE block structure:
        // 4 bytes: picture type (3 = Cover (front))
        // 4 bytes: MIME type string length
        // n bytes: MIME type string
        // 4 bytes: description length
        // n bytes: description
        // 4 bytes: width (0)
        // 4 bytes: height (0)
        // 4 bytes: color depth (0)
        // 4 bytes: number of colors (0)
        // 4 bytes: picture data length
        // n bytes: picture data
        const picHeader = Buffer.alloc(4 + 4 + mimeBuf.length + 4 + descBuf.length + 16 + 4);
        let pOffset = 0;
        picHeader.writeUInt32BE(3, pOffset); pOffset += 4; // Type 3 = Front cover
        picHeader.writeUInt32BE(mimeBuf.length, pOffset); pOffset += 4;
        mimeBuf.copy(picHeader, pOffset); pOffset += mimeBuf.length;
        picHeader.writeUInt32BE(descBuf.length, pOffset); pOffset += 4;
        descBuf.copy(picHeader, pOffset); pOffset += descBuf.length;
        picHeader.writeUInt32BE(0, pOffset); pOffset += 4; // width
        picHeader.writeUInt32BE(0, pOffset); pOffset += 4; // height
        picHeader.writeUInt32BE(24, pOffset); pOffset += 4; // depth
        picHeader.writeUInt32BE(0, pOffset); pOffset += 4; // colors
        picHeader.writeUInt32BE(picBytes.length, pOffset);

        newPictureData = Buffer.concat([picHeader, picBytes]);
      }
    } else if (existingPicBlock) {
      newPictureData = existingPicBlock.data;
    }

    // Assemble new metadata blocks
    const nonCommentBlocks = blocks.filter(b => b.type !== 4 && b.type !== 6);
    const newBlocksList: { type: number; data: Buffer }[] = [];

    // Keep STREAMINFO (type 0) first
    const streamInfo = nonCommentBlocks.find(b => b.type === 0);
    if (streamInfo) {
      newBlocksList.push({ type: 0, data: streamInfo.data });
    }

    // Add Vorbis comment block
    newBlocksList.push({ type: 4, data: newVorbisData });

    // Add Picture block if present
    if (newPictureData) {
      newBlocksList.push({ type: 6, data: newPictureData });
    }

    // Add other non-comment blocks (e.g. SEEKTABLE, PADDING)
    for (const b of nonCommentBlocks) {
      if (b.type !== 0) {
        newBlocksList.push({ type: b.type, data: b.data });
      }
    }

    // Assemble file buffers
    const outBuffers: Buffer[] = [Buffer.from('fLaC', 'ascii')];
    for (let i = 0; i < newBlocksList.length; i++) {
      const b = newBlocksList[i];
      const isLastBlock = i === newBlocksList.length - 1;
      const blockHeader = Buffer.alloc(4);
      const typeByte = (isLastBlock ? 0x80 : 0x00) | (b.type & 0x7f);
      blockHeader.writeUInt8(typeByte, 0);
      blockHeader.writeUInt8((b.data.length >> 16) & 0xff, 1);
      blockHeader.writeUInt8((b.data.length >> 8) & 0xff, 2);
      blockHeader.writeUInt8(b.data.length & 0xff, 3);

      outBuffers.push(blockHeader);
      outBuffers.push(b.data);
    }

    outBuffers.push(audioData);

    const finalBuffer = Buffer.concat(outBuffers);
    await fs.promises.writeFile(filePath, finalBuffer);
  }

  /**
   * Writes track metadata and cover art to a WAV file as an embedded ID3v2 tag
   * in an 'id3 ' RIFF chunk (INT-TAG-007).
   *
   * WAV has no native tag model that carries album artist, disc numbers, or
   * cover art, but the RIFF container permits an application chunk holding a
   * standard ID3v2 tag, and that is what music-metadata reads back and what
   * ffmpeg copies with -map_metadata during the car-sync transcode. Any
   * existing 'id3 '/'ID3 ' chunk is replaced in place; every other chunk,
   * including the audio 'data', is copied through unchanged.
   */
  private async writeWavTags(filePath: string, updates: TagUpdates): Promise<void> {
    const buf = await fs.promises.readFile(filePath);
    const existingProducer = updates.producer === undefined ? await this.readProducerFromFile(filePath) : undefined;
    if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('Not a valid WAV file: missing RIFF/WAVE header');
    }

    // Parse the chunk list after the 12-byte RIFF header. RIFF chunks are
    // word-aligned: an odd payload length is followed by one pad byte.
    type RiffChunk = { id: string; data: Buffer };
    const chunks: RiffChunk[] = [];
    let offset = 12;
    while (offset + 8 <= buf.length) {
      const id = buf.toString('ascii', offset, offset + 4);
      const size = buf.readUInt32LE(offset + 4);
      const dataStart = offset + 8;
      const dataEnd = Math.min(dataStart + size, buf.length);
      chunks.push({ id, data: buf.subarray(dataStart, dataEnd) });
      offset = dataStart + size + (size % 2);
    }

    // Merge the requested changes onto any tag already embedded in the file.
    const existingId3 = chunks.find(c => c.id.toLowerCase() === 'id3 ');
    const base: NodeID3.Tags = existingId3 ? (NodeID3.read(existingId3.data) || {}) : {};
    const tags: NodeID3.Tags = { ...base };

    if (updates.title !== undefined) tags.title = updates.title;
    if (updates.artist !== undefined) tags.artist = updates.artist;
    if (updates.album !== undefined) tags.album = updates.album;
    if (updates.albumArtist !== undefined) tags.performerInfo = updates.albumArtist;
    if (updates.producer !== undefined) {
      tags.involvedPeopleList = updates.producer.trim()
        ? `producer${String.fromCharCode(0)}${updates.producer.trim()}`
        : undefined;
    } else if (existingProducer) {
      tags.involvedPeopleList = `producer${String.fromCharCode(0)}${existingProducer}`;
    }
    if (updates.genre !== undefined) tags.genre = updates.genre;
    if (updates.year !== undefined) tags.year = updates.year ? `${updates.year}` : undefined;

    if (updates.trackNumber !== undefined || updates.totalTracks !== undefined) {
      const no = updates.trackNumber ?? (base.trackNumber ? parseInt(base.trackNumber, 10) : undefined);
      const total = updates.totalTracks;
      tags.trackNumber = no ? (total ? `${no}/${total}` : `${no}`) : undefined;
    }
    if (updates.discNumber !== undefined || updates.totalDiscs !== undefined) {
      const no = updates.discNumber ?? (base.partOfSet ? parseInt(base.partOfSet, 10) : undefined);
      const total = updates.totalDiscs;
      tags.partOfSet = no ? (total ? `${no}/${total}` : `${no}`) : undefined;
    }
    if (updates.picture !== undefined) {
      if (updates.picture === null) {
        delete tags.image;
      } else {
        tags.image = {
          mime: updates.picture.format || 'image/jpeg',
          type: { id: 3, name: 'front cover' },
          description: 'Cover',
          imageBuffer: dataUriToBuffer(updates.picture.data),
        };
      }
    }

    const id3Buffer = NodeID3.create(tags) as Buffer;

    // Rebuild the chunk list: replace the first 'id3 ' chunk, drop any
    // duplicates, append one if the file had none.
    const rebuilt: RiffChunk[] = [];
    let placed = false;
    for (const c of chunks) {
      if (c.id.toLowerCase() === 'id3 ') {
        if (!placed) {
          rebuilt.push({ id: 'id3 ', data: id3Buffer });
          placed = true;
        }
      } else {
        rebuilt.push(c);
      }
    }
    if (!placed) rebuilt.push({ id: 'id3 ', data: id3Buffer });

    // Serialise: 'RIFF' <bodyLength> 'WAVE' <chunk>...
    const body: Buffer[] = [Buffer.from('WAVE', 'ascii')];
    for (const c of rebuilt) {
      const header = Buffer.alloc(8);
      header.write(c.id.padEnd(4).slice(0, 4), 0, 'ascii');
      header.writeUInt32LE(c.data.length, 4);
      body.push(header, c.data);
      if (c.data.length % 2 === 1) body.push(Buffer.from([0x00]));
    }
    const bodyBuf = Buffer.concat(body);

    const riffHeader = Buffer.alloc(8);
    riffHeader.write('RIFF', 0, 'ascii');
    riffHeader.writeUInt32LE(bodyBuf.length, 4);

    await fs.promises.writeFile(filePath, Buffer.concat([riffHeader, bodyBuf]));
  }
}
