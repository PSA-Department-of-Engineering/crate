import { Track } from '../../../models/types';
import { getOrganizationRelativePath, isUnknownMetadataValue } from '../../../utils/organization-path';
import { Rule, RuleContext, RuleViolation } from '../types';

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function joinRootAndRelative(root: string, relativePath: string): string {
  const normalizedRoot = normalizePath(root);
  if (normalizedRoot === '/') {
    return '/' + relativePath;
  }
  return normalizedRoot + '/' + relativePath;
}

function isInsideRoot(filePath: string, root: string): boolean {
  const normalizedPath = normalizePath(filePath).toLowerCase();
  const normalizedRoot = normalizePath(root).toLowerCase();
  return normalizedRoot === '/'
    ? normalizedPath.startsWith('/')
    : normalizedPath === normalizedRoot || normalizedPath.startsWith(normalizedRoot + '/');
}

/**
 * Rule: organize source-library files according to the metadata entered in the
 * Tag Editor. The rule only reports a violation; the Electron adapter performs
 * the filesystem move after the user approves the Fix preview.
 */
export const OrganizeByMetadataRule: Rule = {
  id: 'rule-organize-by-metadata',
  name: 'Organize files by Artist and Album metadata',
  description: 'Creates the Artist/Album folder structure and moves tracks whose current path does not match their saved metadata.',
  category: 'structure',

  evaluate: (track: Track, context?: RuleContext): RuleViolation | null => {
    const libraryRoot = context?.libraryRoot?.trim();
    if (!libraryRoot || track.isCorrupt) {
      return null;
    }

    // Unknown values are scanner fallbacks, not safe folder names. Let the
    // user fill them in through the Tag Editor before organization runs.
    if (isUnknownMetadataValue(track.artist) || isUnknownMetadataValue(track.album)) {
      return null;
    }

    if (!isInsideRoot(track.filePath, libraryRoot)) {
      return null;
    }

    const relativePath = getOrganizationRelativePath(track);
    const proposedPath = joinRootAndRelative(libraryRoot, relativePath);
    const currentPath = normalizePath(track.filePath);

    if (currentPath.toLowerCase() === proposedPath.toLowerCase()) {
      return null;
    }

    const rootWithSlash = normalizePath(libraryRoot) === '/' ? '/' : normalizePath(libraryRoot) + '/';
    const currentValue = currentPath.toLowerCase().startsWith(rootWithSlash.toLowerCase())
      ? currentPath.substring(rootWithSlash.length)
      : currentPath;

    return {
      id: 'rule-organize-by-metadata-' + track.id,
      ruleId: 'rule-organize-by-metadata',
      ruleName: 'Organize files by Artist and Album metadata',
      category: 'structure',
      trackId: track.id,
      filePath: track.filePath,
      currentValue,
      proposedValue: relativePath,
      proposedRenamePath: proposedPath,
      reason: 'The saved Artist and Album metadata points to a different library folder. The Fix will create missing folders and move the track without overwriting an existing file.',
    };
  },
};
