import { describe, expect, it } from 'vitest';
import { intent } from './intent-helper';
import { Track } from '../src/models/types';
import { getOrganizationRelativePath } from '../src/utils/organization-path';
import { OrganizeByMetadataRule } from '../src/services/rules/implementations/OrganizeByMetadataRule';

const exampleTrack: Track = {
  id: 'oh-tel-track',
  filePath: 'C:/Music/PTV/OhTel - ONE STAR/4. OhTel & Kaizen - Ride or Die, prod@RicoWorld.wav',
  title: 'Ride or Die, prod@RicoWorld',
  artist: 'OhTel & Kaizen',
  album: 'ONE STAR',
  trackNumber: 4,
  duration: 180,
  format: 'wav',
  fileSize: 100,
  mtime: 1,
};

describe('Organize by metadata rule', () => {
  it('detects a tagged track outside its canonical Artist/Album path', () => {
    const violation = OrganizeByMetadataRule.evaluate(exampleTrack, { libraryRoot: 'C:/Music' });

    expect(violation).toMatchObject({
      ruleId: 'rule-organize-by-metadata',
      category: 'structure',
      currentValue: 'PTV/OhTel - ONE STAR/4. OhTel & Kaizen - Ride or Die, prod@RicoWorld.wav',
      proposedValue: 'OhTel & Kaizen/ONE STAR/04 Ride or Die, prod@RicoWorld.wav',
      proposedRenamePath: 'C:/Music/OhTel & Kaizen/ONE STAR/04 Ride or Die, prod@RicoWorld.wav',
    });
  });

  it('does not report a track that already matches its metadata path', () => {
    const organizedTrack = {
      ...exampleTrack,
      filePath: 'C:/Music/' + getOrganizationRelativePath(exampleTrack),
    };

    expect(OrganizeByMetadataRule.evaluate(organizedTrack, { libraryRoot: 'C:/Music' })).toBeNull();
  });

  it('waits for real artist and album metadata instead of organizing scanner fallbacks', () => {
    expect(
      OrganizeByMetadataRule.evaluate(
        { ...exampleTrack, artist: 'Unknown Artist', album: 'Unknown Album' },
        { libraryRoot: 'C:/Music' }
      )
    ).toBeNull();
  });

  intent('INT-ORG-004', 'Organization rule derives folders from saved metadata and proposes safe moves', async () => {
    const compilationTrack = {
      ...exampleTrack,
      artist: 'Guest Singer',
      albumArtist: 'Various Artists',
    };

    expect(getOrganizationRelativePath(compilationTrack)).toBe(
      'Various Artists/ONE STAR/04 Ride or Die, prod@RicoWorld.wav'
    );
  });
});
