import { describe, expect } from 'vitest';
import { intent } from './intent-helper';
import { PlaylistExporterService } from '../electron/services/playlist-exporter';
import { Track } from '../src/models/types';

describe('Playlist Export Service', () => {
  const tracks: Track[] = [
    {
      id: '1',
      filePath: 'C:/Music/Pink Floyd/The Wall/01 In the Flesh?.mp3',
      title: 'In the Flesh?',
      artist: 'Pink Floyd',
      album: 'The Wall',
      trackNumber: 1,
      duration: 196,
      format: 'mp3',
      fileSize: 5000000,
      mtime: 1000,
    },
    {
      id: '2',
      filePath: 'C:/Music/Pink Floyd/The Wall/02 The Thin Ice.flac',
      title: 'The Thin Ice',
      artist: 'Pink Floyd',
      album: 'The Wall',
      trackNumber: 2,
      duration: 147,
      format: 'flac',
      fileSize: 15000000,
      mtime: 1000,
    },
  ];

  intent('INT-PLST-001', 'Playlist exporter formats M3U files with relative paths from library/target root', async () => {
    // Relative paths generation for car layout
    const content = PlaylistExporterService.generateM3UContent(tracks, 'E:/', undefined, true);

    expect(content).toContain('#EXTM3U');
    expect(content).toContain('#EXTINF:196,Pink Floyd - In the Flesh?');
    expect(content).toContain('Pink Floyd/The Wall/01 In the Flesh_.mp3');
    expect(content).toContain('#EXTINF:147,Pink Floyd - The Thin Ice');
    expect(content).toContain('Pink Floyd/The Wall/02 The Thin Ice.flac');
  });

  intent('INT-PLST-002', 'Playlist exporter uses CRLF line endings and UTF-8 encoding for car head units', async () => {
    // Contract: Strict CRLF (\r\n) line endings matching car firmware specifications
    const content = PlaylistExporterService.generateM3UContent(tracks, 'E:/', undefined, true);

    expect(content.includes('\r\n')).toBe(true);
    const lines = content.split('\r\n');
    expect(lines[0]).toBe('#EXTM3U');
    expect(lines[1]).toBe('#EXTINF:196,Pink Floyd - In the Flesh?');
  });
});
