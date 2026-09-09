import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { intent } from './intent-helper';
import { moveLibraryFile } from '../electron/services/library-organizer';

describe('Managed library file moves', () => {
  it('creates missing Artist/Album folders and moves the file', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-organizer-'));
    try {
      const source = path.join(root, 'incoming', 'song.mp3');
      const destination = path.join(root, 'New Artist', 'New Album', '01 Song.mp3');
      await fs.promises.mkdir(path.dirname(source), { recursive: true });
      await fs.promises.writeFile(source, 'audio fixture');

      const result = await moveLibraryFile(source, destination, root);

      expect(result.destinationPath).toBe(path.resolve(destination));
      await expect(fs.promises.access(source)).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(fs.promises.readFile(destination, 'utf8')).resolves.toBe('audio fixture');
    } finally {
      await fs.promises.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects an existing destination without changing the source', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-organizer-'));
    try {
      const source = path.join(root, 'incoming', 'song.mp3');
      const destination = path.join(root, 'New Artist', 'New Album', '01 Song.mp3');
      await fs.promises.mkdir(path.dirname(source), { recursive: true });
      await fs.promises.mkdir(path.dirname(destination), { recursive: true });
      await fs.promises.writeFile(source, 'source audio');
      await fs.promises.writeFile(destination, 'existing audio');

      await expect(moveLibraryFile(source, destination, root)).rejects.toThrow(
        'Destination already exists'
      );
      await expect(fs.promises.readFile(source, 'utf8')).resolves.toBe('source audio');
      await expect(fs.promises.readFile(destination, 'utf8')).resolves.toBe('existing audio');
    } finally {
      await fs.promises.rm(root, { recursive: true, force: true });
    }
  });

  intent('INT-ORG-004', 'Organization moves remain inside the selected library root', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-organizer-'));
    try {
      const source = path.join(root, 'incoming', 'song.mp3');
      await fs.promises.mkdir(path.dirname(source), { recursive: true });
      await fs.promises.writeFile(source, 'source audio');

      await expect(
        moveLibraryFile(source, path.join(root, '..', 'outside.mp3'), root)
      ).rejects.toThrow('outside the managed library root');
      await expect(fs.promises.access(source)).resolves.toBeUndefined();
    } finally {
      await fs.promises.rm(root, { recursive: true, force: true });
    }
  });
});
