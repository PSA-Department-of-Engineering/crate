import { Track, TagUpdates } from '../../../models/types';
import { Rule, RuleViolation } from '../types';

/**
 * Patterns matching promotional and downloader junk, watermarks, and noise.
 * Explicitly excludes legitimate artist features (feat., ft., with).
 */
const PROMO_PATTERNS = [
  /\s*--\s*\(?[a-z0-9\-_.]+\.(com|net|org|co|io|ru)\)?/gi, // e.g. --(MixJoint.com), --MixJoint.com
  /\s*\[\s*(official\s*(video|audio)|320\s*kbps|explicit|clean|hq|hd|remastered\s*edition)\s*\]/gi,
  /\s*\(\s*(official\s*(video|audio)|320\s*kbps|prod(?:uced)?\.?\s*by[^)]+)\s*\)/gi, // e.g. (Produced by Scott Storch...)
  /\s*\[?\b(www\.[a-z0-9\-]+\.[a-z]{2,4})\b\]?/gi, // e.g. www.mixtapes.com
];

export function cleanPromoText(text: string): string {
  let cleaned = text;

  for (const pattern of PROMO_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Replace multiple spaces or messy underscore separators:
  // e.g. "01_-_Song_Title.mp3" -> "01 - Song Title.mp3"
  cleaned = cleaned.replace(/_+/g, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  return cleaned.trim();
}

/**
 * Rule: Strip promotional and download junk while strictly preserving artist features.
 */
export const StripPromoJunkRule: Rule = {
  id: 'rule-strip-promo-junk',
  name: 'Strip promotional and download junk',
  description: 'Removes website URLs, promotional watermarks, and producer junk strings while strictly preserving artist feature credits.',
  category: 'cleanup',

  evaluate: (track: Track): RuleViolation | null => {
    const normalized = track.filePath.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    const dir = lastSlash !== -1 ? normalized.substring(0, lastSlash) : '';
    const filename = lastSlash !== -1 ? normalized.substring(lastSlash + 1) : normalized;

    // Check filename
    const extIndex = filename.lastIndexOf('.');
    const ext = extIndex !== -1 ? filename.substring(extIndex) : '';
    const baseName = extIndex !== -1 ? filename.substring(0, extIndex) : filename;

    const cleanedBaseName = cleanPromoText(baseName);
    const cleanedTitle = track.title ? cleanPromoText(track.title) : undefined;

    const hasFilenameChange = cleanedBaseName !== baseName && cleanedBaseName.length > 0;
    const hasTitleChange = cleanedTitle !== undefined && cleanedTitle !== track.title && cleanedTitle.length > 0;

    if (hasFilenameChange || hasTitleChange) {
      const proposedFilename = hasFilenameChange ? `${cleanedBaseName}${ext}` : filename;
      const proposedPath = dir ? `${dir}/${proposedFilename}` : proposedFilename;

      const proposedTagUpdates: TagUpdates | undefined = hasTitleChange && cleanedTitle
        ? { title: cleanedTitle }
        : undefined;

      return {
        id: `rule-strip-promo-${track.id}`,
        ruleId: 'rule-strip-promo-junk',
        ruleName: 'Strip promotional and download junk',
        category: 'cleanup',
        trackId: track.id,
        filePath: track.filePath,
        currentValue: hasFilenameChange ? filename : (track.title || filename),
        proposedValue: hasFilenameChange ? proposedFilename : (cleanedTitle || proposedFilename),
        proposedRenamePath: hasFilenameChange ? proposedPath : undefined,
        proposedTagUpdates,
        reason: 'Contains website URLs, downloader watermarks, or unwanted promotional noise.',
      };
    }

    return null;
  },
};
