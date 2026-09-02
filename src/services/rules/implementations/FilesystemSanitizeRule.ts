import { Track } from '../../../models/types';
import { Rule, RuleViolation } from '../types';

/**
 * OS & FAT32 strictly forbidden characters:
 * < (less than), > (greater than), : (colon), " (double quote),
 * / (forward slash), \ (backslash), | (vertical bar or pipe),
 * ? (question mark), * (asterisk), ASCII control characters (0-31).
 *
 * NOTE: Safe characters ($ like A$AP Rocky, curly quotes ’, &, !, [], etc.)
 * are deliberately preserved and NEVER stripped.
 */
const FORBIDDEN_FS_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

export function sanitizeFilename(filename: string): string {
  // Extract extension
  const extIndex = filename.lastIndexOf('.');
  const ext = extIndex !== -1 ? filename.substring(extIndex) : '';
  let baseName = extIndex !== -1 ? filename.substring(0, extIndex) : filename;

  // Replace forbidden characters with clean hyphen or underscore
  baseName = baseName.replace(FORBIDDEN_FS_CHARS, '-');

  // Collapse multiple consecutive hyphens or spaces
  baseName = baseName.replace(/-{2,}/g, '-');
  baseName = baseName.replace(/\s{2,}/g, ' ');

  // Strip trailing hyphens, dots and spaces which are illegal/ugly on FAT32/Windows
  baseName = baseName.replace(/[-. ]+$/, '').trim();

  if (baseName.length === 0) {
    baseName = 'Track';
  }

  return `${baseName}${ext}`;
}

export const FilesystemSanitizeRule: Rule = {
  id: 'rule-filesystem-sanitize',
  name: 'Filesystem illegal character sanitization',
  description: 'Sanitizes OS-forbidden characters (: * ? " < > |) and trailing dots/spaces while strictly preserving safe characters ($ and Unicode).',
  category: 'filename',

  evaluate: (track: Track): RuleViolation | null => {
    const normalized = track.filePath.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    const dir = lastSlash !== -1 ? normalized.substring(0, lastSlash) : '';
    const filename = lastSlash !== -1 ? normalized.substring(lastSlash + 1) : normalized;

    const sanitized = sanitizeFilename(filename);

    if (sanitized !== filename) {
      const proposedPath = dir ? `${dir}/${sanitized}` : sanitized;

      return {
        id: `rule-sanitize-${track.id}`,
        ruleId: 'rule-filesystem-sanitize',
        ruleName: 'Filesystem illegal character sanitization',
        category: 'filename',
        trackId: track.id,
        filePath: track.filePath,
        currentValue: filename,
        proposedValue: sanitized,
        proposedRenamePath: proposedPath,
        reason: 'Contains filesystem-illegal characters (: * ? " < > |) or trailing dots/spaces that cause file copy errors on USB media.',
      };
    }

    return null;
  },
};
