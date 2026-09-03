import { Track } from '../../../models/types';
import { Rule, RuleViolation } from '../types';

export const MAX_AUTOMOTIVE_PATH_LENGTH = 260;

/**
 * Rule: Enforce automotive FAT32/exFAT MAX_PATH (260 characters) limit.
 * Automotive infotainment units (QNX, BMW iDrive, Audi MMI, Ford SYNC) frequently truncate
 * or silently drop tracks when the absolute file path exceeds 260 characters.
 */
export const MaxPathLengthRule: Rule = {
  id: 'rule-max-path-length',
  name: 'Enforce automotive MAX_PATH filesystem limit',
  description: 'Flags file paths exceeding the 260-character FAT32/exFAT limit and safely truncates long titles.',
  category: 'filename',

  evaluate: (track: Track): RuleViolation | null => {
    const normalized = track.filePath.replace(/\\/g, '/');
    if (normalized.length <= MAX_AUTOMOTIVE_PATH_LENGTH) {
      return null;
    }

    const excess = normalized.length - MAX_AUTOMOTIVE_PATH_LENGTH;
    const lastSlash = normalized.lastIndexOf('/');
    const dir = lastSlash !== -1 ? normalized.substring(0, lastSlash) : '';
    const filename = lastSlash !== -1 ? normalized.substring(lastSlash + 1) : normalized;

    const extIndex = filename.lastIndexOf('.');
    const ext = extIndex !== -1 ? filename.substring(extIndex) : '';
    const baseName = extIndex !== -1 ? filename.substring(0, extIndex) : filename;

    // Check for track number prefix (e.g. "01 ", "01. ", "01 - ")
    const prefixMatch = baseName.match(/^(\d{1,3}[\.\s\-_]+)(.+)$/);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    const titleBody = prefixMatch ? prefixMatch[2] : baseName;

    // Truncate title body to absorb excess (with an extra buffer of 3 for safety)
    const targetLength = Math.max(8, titleBody.length - excess - 2);
    const truncatedTitle = titleBody.substring(0, targetLength).trim();

    const proposedFilename = `${prefix}${truncatedTitle}${ext}`;
    const proposedPath = dir ? `${dir}/${proposedFilename}` : proposedFilename;

    return {
      id: `rule-maxpath-${track.id}`,
      ruleId: 'rule-max-path-length',
      ruleName: 'Enforce automotive MAX_PATH filesystem limit',
      category: 'filename',
      trackId: track.id,
      filePath: track.filePath,
      currentValue: `${filename} (${normalized.length} chars)`,
      proposedValue: `${proposedFilename} (${proposedPath.length} chars)`,
      proposedRenamePath: proposedPath,
      reason: `Path length (${normalized.length} characters) exceeds the 260-character FAT32/exFAT automotive limit, which causes car stereos to crash or skip tracks.`,
    };
  },
};
