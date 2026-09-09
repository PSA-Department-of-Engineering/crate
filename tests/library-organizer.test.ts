import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { intent } from './intent-helper';
import { moveLibraryFile, validateLibraryMoveRequest } from '../electron/services/library-organizer';

describe('Managed library file moves', () => {
  it('validates renderer move payloads against the configured library root', () => {
    const configuredRoot = path.join(os.tmpdir(), 'crate-library');

    expect(
      validateLibraryMoveRequest(
        { filePath: path.join(configuredRoot, 'song.mp3'), destinationPath: path.join(configuredRoot, 'Artist', 'song.mp3'), libraryRoot: configuredRoot },
        configuredRoot
      )
    ).toMatchObject({
      filePath: path.join(configuredRoot, 'song.mp3'),
      destinationPath: path.join(configuredRoot, 'Artist', 'song.mp3'),
      libraryRoot: configuredRoot,
    });

    expect(() =>
      validateLibraryMoveRequest(
        { filePath: path.join(configuredRoot, 'song.mp3'), destinationPath: path.join(configuredRoot, 'song.mp3'), libraryRoot: path.join(os.tmpdir(), 'attacker-root') },
        configuredRoot
      )
    ).toThrow('does not match the configured library root');
  });

  it('rejects malformed renderer move payloads', () => {
    expect(() => validateLibraryMoveRequest({ filePath: 42 }, 'C:/Music')).toThrow('Invalid library move request');
  });

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

  it('rejects a destination routed through a symlink or junction', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-organizer-root-'));
    const outside = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'crate-organizer-outside-'));
    try {
      const source = path.join(root, 'incoming', 'song.mp3');
      const linkedArtist = path.join(root, 'Artist');
      const destination = path.join(linkedArtist, 'Album', '01 Song.mp3');
      await fs.promises.mkdir(path.dirname(source), { recursive: true });
      await fs.promises.writeFile(source, 'source audio');
      await fs.promises.symlink(outside, linkedArtist, process.platform === 'win32' ? 'junction' : 'dir');

      await expect(moveLibraryFile(source, destination, root)).rejects.toThrow(
        /symbolic link or junction|resolves outside the managed library root/
      );
      await expect(fs.promises.readFile(source, 'utf8')).resolves.toBe('source audio');
      await expect(fs.promises.access(path.join(outside, 'Album', '01 Song.mp3'))).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await fs.promises.rm(root, { recursive: true, force: true });
      await fs.promises.rm(outside, { recursive: true, force: true });
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
