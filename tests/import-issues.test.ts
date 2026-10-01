import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ImportIssuesBanner } from '../src/components/ImportIssuesBanner';
import { ImportIssuesModal } from '../src/components/ImportIssuesModal';
import { formatImportSummary } from '../src/utils/library-utils';
import { LibraryDatabaseService } from '../electron/services/library-database';
import { LibraryScannerService } from '../electron/services/library-scanner';
import { AudioMetadataService } from '../electron/services/audio-metadata';

describe('Surface files that failed to import (#71)', () => {
  describe('formatImportSummary', () => {
    it('reports imported tracks and unreadable files, excluding corrupt placeholders from the count', () => {
      expect(formatImportSummary(4819, 7)).toBe('Imported 4,812 tracks. 7 files could not be read.');
    });

    it('uses singular wording for one track and one file', () => {
      expect(formatImportSummary(2, 1)).toBe('Imported 1 track. 1 file could not be read.');
    });

    it('omits the failure sentence when every file was read', () => {
      expect(formatImportSummary(12, 0)).toBe('Imported 12 tracks.');
    });
  });

  describe('ImportIssuesBanner', () => {
    it('renders the post-scan summary and a way to view the files', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ImportIssuesBanner, {
          trackCount: 10,
          corruptCount: 3,
          onViewFiles: vi.fn(),
          onDismiss: vi.fn(),
        })
      );
      expect(html).toContain('Imported 7 tracks. 3 files could not be read.');
      expect(html).toContain('View files');
      expect(html).toContain('Dismiss');
    });
  });

  describe('ImportIssuesModal', () => {
    const corruptFiles = ['C:/Music/Bad/01 Broken.mp3', 'C:/Music/Bad/02 Truncated.flac'];

    it('renders nothing when closed', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ImportIssuesModal, { isOpen: false, onClose: vi.fn(), corruptFiles })
      );
      expect(html).toBe('');
    });

    it('lists every unreadable path with a Show in folder action', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ImportIssuesModal, {
          isOpen: true,
          onClose: vi.fn(),
          corruptFiles,
          onShowInFolder: vi.fn(),
        })
      );
      for (const filePath of corruptFiles) {
        expect(html).toContain(filePath);
      }
      expect(html.match(/Show in folder<\/button>/g)?.length).toBe(corruptFiles.length);
      expect(html).toContain('2 files could not be read');
    });

    it('hides Show in folder when the bridge cannot reveal files', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ImportIssuesModal, { isOpen: true, onClose: vi.fn(), corruptFiles })
      );
      expect(html).not.toContain('Show in folder</button>');
    });
  });

  it('persists unreadable files in the library cache so they survive a cold start', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-import-issues-test-'));
    const musicDir = path.join(tempDir, 'music');
    const dbPath = path.join(tempDir, 'library.db');
    const brokenFile = path.join(musicDir, 'broken.mp3');

    try {
      await fs.promises.mkdir(musicDir, { recursive: true });
      await fs.promises.writeFile(brokenFile, Buffer.from('not an audio file'));

      const scanDb = new LibraryDatabaseService(dbPath);
      // music-metadata tolerates many malformed MP3s, so force the parse
      // failure rather than depend on which bytes it rejects.
      const failingReader = {
        readTrack: vi.fn().mockRejectedValue(new Error('metadata parse error')),
      } as unknown as AudioMetadataService;
      const scanResult = await new LibraryScannerService(failingReader, scanDb).scanDirectory(musicDir);
      scanDb.close();
      expect(scanResult.corruptFiles).toEqual([brokenFile]);

      // Cold start: a fresh service over the same database file, as the
      // library:get-cached handler derives corruptFiles from stored tracks.
      const coldDb = new LibraryDatabaseService(dbPath);
      const cachedCorrupt = coldDb.getAllTracks().filter(t => t.isCorrupt).map(t => t.filePath);
      coldDb.close();
      expect(cachedCorrupt).toEqual([brokenFile]);
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });
});
