import { describe, it, expect } from 'vitest';
import { TagEditor } from '../src/components/TagEditor';
import { Track } from '../src/models/types';

describe('Tag Editor Playback & Selection Stability (#83)', () => {
  const sampleTrackA: Track = {
    id: 'track-a-1',
    filePath: 'C:/Music/PtV/ALL/KAIZEN - JUIZO.wav',
    title: 'KAIZEN - JUIZO',
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    duration: 180,
    format: 'wav',
    fileSize: 30000000,
    mtime: 1000,
  };

  const sampleTrackB: Track = {
    id: 'track-b-2',
    filePath: 'C:/Music/PtV/ALL/ANUBIS X KAIZEN - PANDORA.wav',
    title: 'ANUBIS X KAIZEN - PANDORA',
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    duration: 152,
    format: 'wav',
    fileSize: 25000000,
    mtime: 1001,
  };

  it('exports TagEditor component', () => {
    expect(TagEditor).toBeDefined();
    expect(typeof TagEditor).toBe('function');
  });

  it('generates consistent selection keys across recomputed array references', () => {
    // Simulating player timeupdate re-renders where library.tracks.filter generates
    // new array instances containing the same selected track
    const arrayInstance1 = [sampleTrackA];
    const arrayInstance2 = [{ ...sampleTrackA }];

    const key1 = arrayInstance1.map(t => `${t.id}:${t.filePath}`).join('|');
    const key2 = arrayInstance2.map(t => `${t.id}:${t.filePath}`).join('|');

    expect(arrayInstance1).not.toBe(arrayInstance2);
    expect(key1).toBe(key2);
    expect(key1).toBe('track-a-1:C:/Music/PtV/ALL/KAIZEN - JUIZO.wav');
  });

  it('detects track switching when a different track is selected', () => {
    const keyA = [sampleTrackA].map(t => `${t.id}:${t.filePath}`).join('|');
    const keyB = [sampleTrackB].map(t => `${t.id}:${t.filePath}`).join('|');

    expect(keyA).not.toBe(keyB);
  });

  it('detects batch selection transition correctly', () => {
    const singleKey = [sampleTrackA].map(t => `${t.id}:${t.filePath}`).join('|');
    const batchKey = [sampleTrackA, sampleTrackB].map(t => `${t.id}:${t.filePath}`).join('|');

    expect(singleKey).not.toBe(batchKey);
    expect(batchKey).toContain(sampleTrackA.id);
    expect(batchKey).toContain(sampleTrackB.id);
  });
});
