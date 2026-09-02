import { Track } from '../../../models/types';
import { Rule, RuleViolation } from '../types';

/**
 * Rule: Zero-pad single digit track numbers in filenames (e.g. "1. Intro.mp3" -> "01. Intro.mp3")
 * Ensures proper alphabetical playback order in car infotainment and FAT32 USB players.
 */
export const ZeroPadTrackNumberRule: Rule = {
  id: 'rule-zero-pad-track-number',
  name: 'Zero-pad track numbers in filenames',
  description: 'Converts single-digit track number prefixes (1., 1 -, 1 ) to 2-digit zero-padded numbers (01., 01 -, 01 ).',
  category: 'filename',

  evaluate: (track: Track): RuleViolation | null => {
    // Normalize path separators
    const normalized = track.filePath.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    const dir = lastSlash !== -1 ? normalized.substring(0, lastSlash) : '';
    const filename = lastSlash !== -1 ? normalized.substring(lastSlash + 1) : normalized;

    // Matches single-digit track prefix at the very start of filename:
    // e.g. "1. Intro.mp3", "1 - Intro.mp3", "1_Intro.mp3", "1 Intro.mp3"
    const singleDigitRegex = /^(\d)([\.\s\-_])(.+)$/;
    const match = filename.match(singleDigitRegex);

    if (match) {
      const digit = match[1];
      const separator = match[2];
      const rest = match[3];

      const proposedFilename = `0${digit}${separator}${rest}`;
      const proposedPath = dir ? `${dir}/${proposedFilename}` : proposedFilename;

      return {
        id: `rule-zero-pad-${track.id}`,
        ruleId: 'rule-zero-pad-track-number',
        ruleName: 'Zero-pad track numbers in filenames',
        category: 'filename',
        trackId: track.id,
        filePath: track.filePath,
        currentValue: filename,
        proposedValue: proposedFilename,
        proposedRenamePath: proposedPath,
        reason: `Track filename begins with single-digit "${digit}", which causes car audio players to sort tracks out of order.`,
      };
    }

    return null;
  },
};
