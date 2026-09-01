import * as fs from 'fs';
import * as path from 'path';
import { Track } from '../../src/models/types';
import { getCarRelativePath, sanitizeFat32Segment } from './file-organizer';

export interface PlaylistExportOptions {
  playlistName: string;
  tracks: Track[];
  targetDir: string;
  relativeRoot?: string;
  useCarPathStructure?: boolean;
}

export class PlaylistExporterService {
  /**
   * Generates M3U playlist file content with relative paths and CRLF line endings.
   */
  static generateM3UContent(
    tracks: Track[],
    targetDir: string,
    relativeRoot?: string,
    useCarPathStructure: boolean = false
  ): string {
    const lines: string[] = ['#EXTM3U'];
    const baseDir = relativeRoot || targetDir;

    for (const track of tracks) {
      const durationSec = Math.round(track.duration || 0);
      const artist = track.artist || 'Unknown Artist';
      const title = track.title || 'Unknown Title';

      // #EXTINF:<seconds>,<artist> - <title>
      lines.push(`#EXTINF:${durationSec},${artist} - ${title}`);

      let relPath: string;
      if (useCarPathStructure) {
        // Car path e.g. "Pink Floyd/The Wall/01 In the Flesh.mp3"
        relPath = getCarRelativePath(track);
      } else {
        // Compute relative path from targetDir / relativeRoot to track.filePath
        relPath = path.relative(baseDir, track.filePath);
      }

      // Format with Windows-style backslashes or car-compatible forward slashes
      // Car firmware standard supports both, forward slashes or standard relative path
      relPath = relPath.replace(/\\/g, '/');
      lines.push(relPath);
    }

    // Join with Windows CRLF (\r\n) line endings
    return lines.join('\r\n') + '\r\n';
  }

  /**
   * Writes the M3U playlist file to disk with UTF-8 encoding and CRLF line endings.
   */
  static async exportPlaylist(options: PlaylistExportOptions): Promise<string> {
    const safeName = sanitizeFat32Segment(options.playlistName || 'Playlist');
    const filename = `${safeName}.m3u`;
    const targetFilePath = path.join(options.targetDir, filename);

    const content = PlaylistExporterService.generateM3UContent(
      options.tracks,
      options.targetDir,
      options.relativeRoot,
      options.useCarPathStructure ?? true
    );

    // Ensure directory exists
    await fs.promises.mkdir(options.targetDir, { recursive: true });

    // Write file with UTF-8 encoding
    await fs.promises.writeFile(targetFilePath, content, { encoding: 'utf-8' });

    return targetFilePath;
  }
}
