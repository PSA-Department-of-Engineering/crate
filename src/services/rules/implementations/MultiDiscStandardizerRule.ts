import { Track, TagUpdates } from '../../../models/types';
import { Rule, RuleViolation, RuleContext } from '../types';

/**
 * Rule: Multi-disc track numbering and folder standardization.
 * - Flattens CD1/CD2/Disc 1/Disc 2 subfolders into the main album folder.
 * - Preserves disc numbers in ID3/Vorbis metadata (discNumber, totalDiscs).
 * - Numbering continues continuously across discs (Disc 2 continues where Disc 1 ends)
 *   so car players sort all discs seamlessly in a single folder without disc prefix clutter.
 */
export const MultiDiscStandardizerRule: Rule = {
  id: 'rule-multidisc-standardizer',
  name: 'Multi-disc track numbering and folder standardization',
  description: 'Flattens multi-disc subfolders into the main album folder, moves disc numbers into metadata, and ensures continuous track numbering.',
  category: 'structure',

  evaluate: (track: Track, context?: RuleContext): RuleViolation | null => {
    const normalized = track.filePath.replace(/\\/g, '/');
    const segments = normalized.split('/');
    if (segments.length < 3) return null;

    // Check if the immediate parent folder is a disc folder: e.g. "CD1", "CD 2", "Disc 1", "Disc 2"
    const parentFolder = segments[segments.length - 2];
    const filename = segments[segments.length - 1];

    const discMatch = parentFolder.match(/^(?:disc|cd)\s*(\d+)$/i);
    if (!discMatch) {
      return null;
    }

    const detectedDisc = parseInt(discMatch[1], 10);
    // Album folder is one level above the disc folder
    const albumSegments = segments.slice(0, segments.length - 2);
    const albumDir = albumSegments.join('/');

    // Calculate continuous track numbering across discs if context.allTracks is available
    let continuousTrackNumber = track.trackNumber || 1;
    let totalDiscs = track.totalDiscs || detectedDisc;

    if (context?.allTracks && track.album) {
      const albumTracks = context.allTracks.filter(
        t => t.album && t.album.toLowerCase() === track.album.toLowerCase()
      );

      // Find all discs in this album
      const discSet = new Set<number>();
      for (const t of albumTracks) {
        const tSegments = t.filePath.replace(/\\/g, '/').split('/');
        const tParent = tSegments.length >= 3 ? tSegments[tSegments.length - 2] : '';
        const m = tParent.match(/^(?:disc|cd)\s*(\d+)$/i);
        if (m) discSet.add(parseInt(m[1], 10));
        else if (t.discNumber) discSet.add(t.discNumber);
      }
      totalDiscs = Math.max(totalDiscs, ...Array.from(discSet), 1);

      if (detectedDisc > 1) {
        // Count how many tracks exist on earlier discs (e.g. Disc 1)
        let priorTracksCount = 0;
        for (let d = 1; d < detectedDisc; d++) {
          const priorTracks = albumTracks.filter(t => {
            const tSegments = t.filePath.replace(/\\/g, '/').split('/');
            const tParent = tSegments.length >= 3 ? tSegments[tSegments.length - 2] : '';
            const m = tParent.match(/^(?:disc|cd)\s*(\d+)$/i);
            const discNo = m ? parseInt(m[1], 10) : t.discNumber;
            return discNo === d;
          });
          priorTracksCount += priorTracks.length;
        }

        const localTrackNo = track.trackNumber || 1;
        continuousTrackNumber = priorTracksCount + localTrackNo;
      }
    }

    // Format new filename with continuous track number:
    // e.g. "01 Track.mp3" for Disc 1, "13 Track.mp3" for Disc 2
    const paddedTrack = continuousTrackNumber < 10 ? `0${continuousTrackNumber}` : `${continuousTrackNumber}`;

    // Clean existing leading numbers or disc prefixes from filename
    let cleanBaseName = filename.replace(/^\d+[\.\s\-_]+/, '').trim();
    if (!cleanBaseName) cleanBaseName = filename;

    const proposedFilename = `${paddedTrack} ${cleanBaseName}`;
    const proposedPath = `${albumDir}/${proposedFilename}`;

    const proposedTagUpdates: TagUpdates = {
      discNumber: track.discNumber || detectedDisc,
      totalDiscs,
    };

    return {
      id: `rule-multidisc-${track.id}`,
      ruleId: 'rule-multidisc-standardizer',
      ruleName: 'Multi-disc track numbering and folder standardization',
      category: 'structure',
      trackId: track.id,
      filePath: track.filePath,
      currentValue: `${parentFolder}/${filename}`,
      proposedValue: proposedFilename,
      proposedRenamePath: proposedPath,
      proposedTagUpdates,
      reason: `Track is located in subfolder "${parentFolder}". Flattening into main album directory with continuous track number "${paddedTrack}" and disc info in metadata.`,
    };
  },
};
