import { RuleRegistry } from './RuleRegistry';
import {
  ZeroPadTrackNumberRule,
  EnforceTrackNumberPrefixRule,
  StripPromoJunkRule,
  MultiDiscStandardizerRule,
  FilesystemSanitizeRule,
  CompanionJunkCleanupRule,
  MaxPathLengthRule,
  AutoEmbedFolderArtworkRule,
  ArtworkDimensionRule,
  OrganizeByMetadataRule,
} from './implementations';

export function registerDefaultRules(registry: RuleRegistry): void {
  registry.registerRule(ZeroPadTrackNumberRule);
  registry.registerRule(EnforceTrackNumberPrefixRule);
  registry.registerRule(StripPromoJunkRule);
  registry.registerRule(MultiDiscStandardizerRule);
  registry.registerRule(FilesystemSanitizeRule);
  registry.registerRule(CompanionJunkCleanupRule);
  registry.registerRule(MaxPathLengthRule);
  registry.registerRule(AutoEmbedFolderArtworkRule);
  registry.registerRule(ArtworkDimensionRule);
  registry.registerRule(OrganizeByMetadataRule);
}
