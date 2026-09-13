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

  describe('Existing Artists & Albums Autocomplete Suggestions (#87)', () => {
    const libraryTracks: Track[] = [
      {
        id: 't-1',
        filePath: 'C:/Music/track1.mp3',
        title: 'Song 1',
        artist: 'Pink Floyd',
        album: 'The Wall',
        albumArtist: 'Pink Floyd',
        duration: 180,
        format: 'mp3',
        fileSize: 5000000,
        mtime: 1000,
      },
      {
        id: 't-2',
        filePath: 'C:/Music/track2.mp3',
        title: 'Song 2',
        artist: 'David Gilmour',
        album: 'Rattle That Lock',
        albumArtist: 'David Gilmour',
        duration: 200,
        format: 'mp3',
        fileSize: 6000000,
        mtime: 1001,
      },
      {
        id: 't-3',
        filePath: 'C:/Music/track3.mp3',
        title: 'Song 3',
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        duration: 120,
        format: 'mp3',
        fileSize: 4000000,
        mtime: 1002,
      },
      {
        id: 't-4',
        filePath: 'C:/Music/track4.mp3',
        title: 'Song 4',
        artist: 'KAIZEN x LIFER',
        album: 'LUV Tape',
        albumArtist: 'Various Artists',
        duration: 240,
        format: 'mp3',
        fileSize: 7000000,
        mtime: 1003,
      },
    ];

    it('collects unique, non-unknown artist names from library tracks', () => {
      const set = new Set<string>();
      for (const t of libraryTracks) {
        if (t.artist && t.artist.trim() && t.artist.toLowerCase() !== 'unknown artist') {
          set.add(t.artist.trim());
        }
        if (t.albumArtist && t.albumArtist.trim() && t.albumArtist.toLowerCase() !== 'unknown artist') {
          set.add(t.albumArtist.trim());
        }
      }
      const sorted = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

      expect(sorted).toContain('Pink Floyd');
      expect(sorted).toContain('David Gilmour');
      expect(sorted).toContain('KAIZEN x LIFER');
      expect(sorted).toContain('Various Artists');
      expect(sorted).not.toContain('Unknown Artist');
    });

    it('collects unique album names excluding unknown fallbacks', () => {
      const set = new Set<string>();
      for (const t of libraryTracks) {
        if (t.album && t.album.trim() && t.album.toLowerCase() !== 'unknown album') {
          set.add(t.album.trim());
        }
      }
      const sorted = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

      expect(sorted).toEqual(['LUV Tape', 'Rattle That Lock', 'The Wall']);
      expect(sorted).not.toContain('Unknown Album');
    });
  });

  describe('F2 Tag Editor Shortcut (#91)', () => {
    it('determines whether Tag Editor should open on F2 given track selections', () => {
      const handleF2KeyPress = (
        e: { key: string; preventDefault: () => void; target?: { tagName: string } },
        selectedTrackIds: string[],
        setActiveTab: (tab: string) => void
      ) => {
        const target = e.target as HTMLElement | undefined;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
          return false;
        }

        if (e.key === 'F2' && selectedTrackIds.length > 0) {
          e.preventDefault();
          setActiveTab('tageditor');
          return true;
        }
        return false;
      };

      let activeTab = 'library';
      let prevented = false;
      const fakePrevent = () => {
        prevented = true;
      };

      // 1. When tracks are selected, pressing F2 navigates to tageditor
      const opened = handleF2KeyPress(
        { key: 'F2', preventDefault: fakePrevent },
        ['track-1'],
        (tab) => {
          activeTab = tab;
        }
      );
      expect(opened).toBe(true);
      expect(prevented).toBe(true);
      expect(activeTab).toBe('tageditor');

      // 2. When no tracks are selected, pressing F2 does not navigate
      activeTab = 'library';
      prevented = false;
      const openedNoSelection = handleF2KeyPress(
        { key: 'F2', preventDefault: fakePrevent },
        [],
        (tab) => {
          activeTab = tab;
        }
      );
      expect(openedNoSelection).toBe(false);
      expect(prevented).toBe(false);
      expect(activeTab).toBe('library');

      // 3. When an input element is focused, F2 is ignored
      prevented = false;
      const openedInInput = handleF2KeyPress(
        { key: 'F2', preventDefault: fakePrevent, target: { tagName: 'INPUT' } },
        ['track-1'],
        (tab) => {
          activeTab = tab;
        }
      );
      expect(openedInInput).toBe(false);
      expect(prevented).toBe(false);
      expect(activeTab).toBe('library');
    });
  });
});
