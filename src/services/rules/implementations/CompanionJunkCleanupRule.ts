import { Track } from '../../../models/types';
import { Rule, RuleViolation, RuleContext } from '../types';

/**
 * Non-audio junk file extensions and names often left behind by torrents or mixtape downloaders.
 */
const JUNK_EXTENSIONS = new Set(['.url', '.txt', '.nfo']);
const JUNK_FILENAMES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);

/**
 * Extensions and filenames that must NEVER be deleted.
 * All cover art and artwork files are strictly protected.
 */
const PROTECTED_ARTWORK_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);

export function isJunkCompanionFile(filename: string): boolean {
  const lower = filename.toLowerCase();

  // Protect all cover artwork unconditionally
  const extIndex = lower.lastIndexOf('.');
  const ext = extIndex !== -1 ? lower.substring(extIndex) : '';
  if (PROTECTED_ARTWORK_EXTENSIONS.has(ext)) {
    return false;
  }

  // Check junk filenames
  if (JUNK_FILENAMES.has(lower) || lower.startsWith('._')) {
    return true;
  }

  // Check junk extensions (.url, .txt, .nfo)
  if (JUNK_EXTENSIONS.has(ext)) {
    return true;
  }

  return false;
}

export interface ExtendedRuleContext extends RuleContext {
  discoveredCompanionFiles?: string[];
}

export const CompanionJunkCleanupRule: Rule = {
  id: 'rule-companion-junk-cleanup',
  name: 'Companion junk file and orphan promo cleanup',
  description: 'Cleans up .url, .txt, and .nfo download links while strictly preserving album artwork and cover images.',
  category: 'cleanup',

  evaluate: (track: Track, context?: ExtendedRuleContext): RuleViolation | null => {
    // If explicit companion files are passed in context
    if (context?.discoveredCompanionFiles && context.discoveredCompanionFiles.length > 0) {
      const normalizedTrackPath = track.filePath.replace(/\\/g, '/');
      const trackDir = normalizedTrackPath.substring(0, normalizedTrackPath.lastIndexOf('/'));

      for (const companionPath of context.discoveredCompanionFiles) {
        const normalizedCompanion = companionPath.replace(/\\/g, '/');
        const companionDir = normalizedCompanion.substring(0, normalizedCompanion.lastIndexOf('/'));
        const filename = normalizedCompanion.substring(normalizedCompanion.lastIndexOf('/') + 1);

        if (trackDir === companionDir && isJunkCompanionFile(filename)) {
          return {
            id: `rule-junk-${track.id}-${filename}`,
            ruleId: 'rule-companion-junk-cleanup',
            ruleName: 'Companion junk file and orphan promo cleanup',
            category: 'cleanup',
            trackId: track.id,
            filePath: track.filePath,
            currentValue: filename,
            proposedValue: '[Delete junk file]',
            deleteCompanionFile: companionPath,
            reason: `Non-audio companion file "${filename}" is a download link or info text that can cause car head units to pause or show errors. Cover art is safely preserved.`,
          };
        }
      }
    }

    return null;
  },
};
