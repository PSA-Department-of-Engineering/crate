import { Track, TagUpdates } from '../../models/types';

export type RuleCategory = 'filename' | 'tag' | 'structure' | 'cleanup';

export interface RuleViolation {
  id: string; // Unique violation identifier (e.g., `${ruleId}-${track.id}`)
  ruleId: string;
  ruleName: string;
  category: RuleCategory;
  trackId: string;
  filePath: string;
  currentValue: string; // Current state (e.g. "1. Intro.mp3")
  proposedValue: string; // Proposed state after fix (e.g. "01. Intro.mp3")
  reason: string; // Explanation of why this rule was triggered
  proposedTagUpdates?: TagUpdates;
  proposedRenamePath?: string;
  deleteCompanionFile?: string;
}

export interface RuleContext {
  libraryRoot?: string;
  allTracks?: Track[];
  discoveredCompanionFiles?: string[];
  discoveredCompanionFileSizes?: Record<string, number>;
}

export interface RuleApplyResult {
  updatedTrack?: Track;
  renamedPath?: string;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  evaluate: (track: Track, context?: RuleContext) => RuleViolation | null;
  apply?: (
    track: Track,
    violation: RuleViolation,
    context?: RuleContext
  ) => Promise<RuleApplyResult>;
}

export interface RulePreset {
  id: string;
  name: string;
  description?: string;
  ruleIds: string[];
}

export interface RuleAuditResult {
  violations: RuleViolation[];
  totalEvaluated: number;
  violationCount: number;
  rulesEvaluated: string[];
  durationMs: number;
}

export interface BatchProgress {
  current: number;
  total: number;
  percent: number;
  currentViolation: RuleViolation;
}

export interface RuleExecutionResult {
  success: boolean;
  appliedCount: number;
  failedCount: number;
  errors: Array<{ violationId: string; error: string }>;
}
