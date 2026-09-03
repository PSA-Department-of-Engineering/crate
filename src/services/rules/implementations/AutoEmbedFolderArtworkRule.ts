import { Track } from '../../../models/types';
import { Rule, RuleViolation, RuleContext } from '../types';

const COVER_FILENAMES = new Set(['cover.jpg', 'cover.jpeg', 'cover.png', 'folder.jpg', 'folder.png', 'albumart.jpg']);

/**
 * Rule: Auto-embed folder cover artwork into tracks lacking embedded metadata art.
 * Automotive head units exclusively parse embedded ID3 APIC / Vorbis PICTURE blocks.
 * They ignore loose image files in directories, resulting in blank artwork on car displays.
 */
export const AutoEmbedFolderArtworkRule: Rule = {
  id: 'rule-auto-embed-folder-artwork',
  name: 'Auto-embed folder cover artwork into tracks',
  description: 'Embeds loose folder artwork (cover.jpg, folder.jpg) into tracks that lack embedded artwork for car dashboard display.',
  category: 'tag',

  evaluate: (track: Track, context?: RuleContext): RuleViolation | null => {
    // If track already has embedded artwork, skip
    if (track.picture) {
      return null;
    }

    const normalizedTrackPath = track.filePath.replace(/\\/g, '/');
    const trackDir = normalizedTrackPath.substring(0, normalizedTrackPath.lastIndexOf('/'));

    let foundCoverPath: string | null = null;
    let foundCoverName: string = '';

    if (context?.discoveredCompanionFiles && context.discoveredCompanionFiles.length > 0) {
      for (const compPath of context.discoveredCompanionFiles) {
        const normComp = compPath.replace(/\\/g, '/');
        const compDir = normComp.substring(0, normComp.lastIndexOf('/'));
        const filename = normComp.substring(normComp.lastIndexOf('/') + 1).toLowerCase();

        if (compDir === trackDir && COVER_FILENAMES.has(filename)) {
          foundCoverPath = compPath;
          foundCoverName = normComp.substring(normComp.lastIndexOf('/') + 1);
          break;
        }
      }
    }

    if (foundCoverPath) {
      return {
        id: `rule-embed-art-${track.id}`,
        ruleId: 'rule-auto-embed-folder-artwork',
        ruleName: 'Auto-embed folder cover artwork into tracks',
        category: 'tag',
        trackId: track.id,
        filePath: track.filePath,
        currentValue: 'No embedded cover art',
        proposedValue: `Embed folder cover (${foundCoverName}) into metadata`,
        reason: 'Car head units exclusively parse embedded ID3/Vorbis tags and ignore loose image files in the folder. Embedding enables car dashboard album art.',
      };
    }

    return null;
  },
};
