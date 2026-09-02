import { Track } from '../../../models/types';
import { Rule, RuleViolation } from '../types';

/**
 * Rule: Enforce track number prefix in filename using ID3/Vorbis tag metadata.
 * Prepends zero-padded track numbers (e.g. "01 Myron.mp3") to files that currently lack numeric prefixes.
 */
export const EnforceTrackNumberPrefixRule: Rule = {
  id: 'rule-enforce-track-number-filename',
  name: 'Enforce track number prefix in filename',
  description: 'Prepends zero-padded track numbers from metadata to filenames that have no leading number prefix.',
  category: 'filename',

  evaluate: (track: Track): RuleViolation | null => {
    if (!track.trackNumber || isNaN(track.trackNumber) || track.trackNumber <= 0) {
      return null;
    }

    const normalized = track.filePath.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    const dir = lastSlash !== -1 ? normalized.substring(0, lastSlash) : '';
    const filename = lastSlash !== -1 ? normalized.substring(lastSlash + 1) : normalized;

    // Check if filename already starts with any digit
    if (/^\d+/.test(filename)) {
      return null;
    }

    const paddedNumber = track.trackNumber < 10 ? `0${track.trackNumber}` : `${track.trackNumber}`;
    const proposedFilename = `${paddedNumber} ${filename}`;
    const proposedPath = dir ? `${dir}/${proposedFilename}` : proposedFilename;

    return {
      id: `rule-enforce-prefix-${track.id}`,
      ruleId: 'rule-enforce-track-number-filename',
      ruleName: 'Enforce track number prefix in filename',
      category: 'filename',
      trackId: track.id,
      filePath: track.filePath,
      currentValue: filename,
      proposedValue: proposedFilename,
      proposedRenamePath: proposedPath,
      reason: `File has track #${track.trackNumber} in metadata, but lacks a numeric prefix in its filename, causing cars to scramble album playback order.`,
    };
  },
};
