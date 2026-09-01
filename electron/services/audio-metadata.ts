import * as fs from 'fs';
import * as path from 'path';
import * as mm from 'music-metadata';
import NodeID3 from 'node-id3';
import { Track, TagUpdates, AudioFormat, EmbeddedArtwork } from '../../src/models/types';

export class AudioMetadataService {
  /**
   * Reads metadata from an audio file (.mp3 or .flac) and returns a Track object.
   */
  async readTrack(filePath: string): Promise<Track> {
    const stats = await fs.promises.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const format: AudioFormat = ext === '.flac' ? 'flac' : 'mp3';

    try {
      const metadata = await mm.parseFile(filePath, { duration: true, skipCovers: false });
      const common = metadata.common;
      const formatInfo = metadata.format;

      let picture: EmbeddedArtwork | undefined = undefined;
      if (common.picture && common.picture.length > 0) {
        const pic = common.picture[0];
        const base64 = Buffer.from(pic.data).toString('base64');
        picture = {
          format: pic.format || 'image/jpeg',
          data: `data:${pic.format || 'image/jpeg'};base64,${base64}`,
        };
      }

      return {
        id: filePath,
        filePath,
        title: common.title || path.basename(filePath, ext),
        artist: common.artist || 'Unknown Artist',
        album: common.album || 'Unknown Album',
        albumArtist: common.albumartist,
        trackNumber: common.track.no || undefined,
        totalTracks: common.track.of || undefined,
        discNumber: common.disk.no || undefined,
        totalDiscs: common.disk.of || undefined,
        year: common.year,
        genre: common.genre && common.genre.length > 0 ? common.genre.join(', ') : undefined,
        duration: formatInfo.duration || 0,
        bitrate: formatInfo.bitrate ? Math.round(formatInfo.bitrate / 1000) : undefined,
        sampleRate: formatInfo.sampleRate,
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
   * Updates tags on an MP3 or FLAC file on disk without modifying audio stream data.
   */
  async writeTrackTags(filePath: string, updates: TagUpdates): Promise<Track> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.mp3') {
      await this.writeMp3Tags(filePath, updates);
    } else if (ext === '.flac') {
      await this.writeFlacTags(filePath, updates);
    }

    // Re-read file to return updated Track model
    return await this.readTrack(filePath);
  }

  /**
   * Writes ID3v2 tags to an MP3 file using NodeID3.
   */
  private async writeMp3Tags(filePath: string, updates: TagUpdates): Promise<void> {
    const existingTags = NodeID3.read(filePath) || {};

    const newTags: NodeID3.Tags = { ...existingTags };

    if (updates.title !== undefined) newTags.title = updates.title;
    if (updates.artist !== undefined) newTags.artist = updates.artist;
    if (updates.album !== undefined) newTags.album = updates.album;
    if (updates.albumArtist !== undefined) newTags.performerInfo = updates.albumArtist;
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
}
