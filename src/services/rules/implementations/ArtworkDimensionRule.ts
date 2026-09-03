import { Track } from '../../../models/types';
import { Rule, RuleViolation, RuleContext } from '../types';

export const MAX_CAR_ARTWORK_BYTES = 500 * 1024; // 500 KB maximum safe buffer for automotive head units

export interface ExtendedArtworkRuleContext extends RuleContext {
  discoveredCompanionFileSizes?: Record<string, number>; // path -> bytes
}

/**
 * Rule: Downsample oversized artwork for car embedding without modifying master cover files.
 * Large multi-megabyte images crash or time out automotive head unit RAM buffers.
 * The original high-resolution cover file on disk is strictly preserved, and an optimized
 * 500x500 JPEG buffer is used for metadata embedding and car sync.
 */
export const ArtworkDimensionRule: Rule = {
  id: 'rule-artwork-dimension',
  name: 'Downsample oversized artwork for car head unit compatibility',
  description: 'Flags artwork exceeding 500 KB and prepares an optimized buffer for car embedding, keeping master files untouched.',
  category: 'tag',

  evaluate: (track: Track, context?: ExtendedArtworkRuleContext): RuleViolation | null => {
    // 1. Check embedded artwork in track if present
    if (track.picture?.data) {
      // Rough estimate of base64 buffer size in bytes: (length * 3) / 4
      const base64Data = track.picture.data.includes(',')
        ? track.picture.data.split(',')[1]
        : track.picture.data;
      const sizeInBytes = Math.round((base64Data.length * 3) / 4);

      if (sizeInBytes > MAX_CAR_ARTWORK_BYTES) {
        const sizeKB = Math.round(sizeInBytes / 1024);
        return {
          id: `rule-art-size-${track.id}`,
          ruleId: 'rule-artwork-dimension',
          ruleName: 'Downsample oversized artwork for car head unit compatibility',
          category: 'tag',
          trackId: track.id,
          filePath: track.filePath,
          currentValue: `Embedded artwork (${sizeKB} KB)`,
          proposedValue: `Downsample to 500x500 JPEG (~150 KB) for car playback`,
          reason: `Embedded artwork (${sizeKB} KB) exceeds the 500 KB safe limit for automotive head units, risking display lag or blank artwork squares. Master file on disk remains unmodified.`,
        };
      }
    }

    // 2. Check companion cover files in the same directory if size map is provided
    if (context?.discoveredCompanionFiles && context.discoveredCompanionFileSizes) {
      const normalizedTrackPath = track.filePath.replace(/\\/g, '/');
      const trackDir = normalizedTrackPath.substring(0, normalizedTrackPath.lastIndexOf('/'));

      for (const compPath of context.discoveredCompanionFiles) {
        const normComp = compPath.replace(/\\/g, '/');
        const compDir = normComp.substring(0, normComp.lastIndexOf('/'));
        const filename = normComp.substring(normComp.lastIndexOf('/') + 1).toLowerCase();

        if (compDir === trackDir && (filename.startsWith('cover.') || filename.startsWith('folder.'))) {
          const size = context.discoveredCompanionFileSizes[compPath];
          if (size && size > MAX_CAR_ARTWORK_BYTES) {
            const sizeKB = Math.round(size / 1024);
            return {
              id: `rule-art-size-${track.id}-${filename}`,
              ruleId: 'rule-artwork-dimension',
              ruleName: 'Downsample oversized artwork for car head unit compatibility',
              category: 'tag',
              trackId: track.id,
              filePath: track.filePath,
              currentValue: `${filename} (${sizeKB} KB)`,
              proposedValue: `Generate 500x500 (~150 KB) buffer for tags (preserve master ${filename})`,
              reason: `Album cover "${filename}" is ${sizeKB} KB. Embedded car displays fail on images >500 KB. Generates an optimized embedding buffer while leaving the master file intact on disk.`,
            };
          }
        }
      }
    }

    return null;
  },
};
