import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuleRegistry, RulesEngine, Rule, RuleViolation, RulePreset } from '../src/services/rules';
import { Track } from '../src/models/types';

describe('Rules Engine Core', () => {
  let registry: RuleRegistry;
  let engine: RulesEngine;

  const mockTrack1: Track = {
    id: 'track-1',
    filePath: 'C:/Music/Artist/Album/1. Song.mp3',
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    trackNumber: 1,
    duration: 180,
    format: 'mp3',
    fileSize: 5000000,
    mtime: Date.now(),
  };

  const mockTrack2: Track = {
    id: 'track-2',
    filePath: 'C:/Music/Artist/Album/02. Valid.mp3',
    title: 'Valid',
    artist: 'Artist',
    album: 'Album',
    trackNumber: 2,
    duration: 200,
    format: 'mp3',
    fileSize: 6000000,
    mtime: Date.now(),
  };

  const sampleZeroPadRule: Rule = {
    id: 'test-zero-pad',
    name: 'Zero-pad Track Number',
    description: 'Enforces 2-digit padding',
    category: 'filename',
    evaluate: (track: Track): RuleViolation | null => {
      const match = track.filePath.match(/\/(\d+)\.\s/);
      if (match && match[1].length === 1) {
        return {
          id: `test-zero-pad-${track.id}`,
          ruleId: 'test-zero-pad',
          ruleName: 'Zero-pad Track Number',
          category: 'filename',
          trackId: track.id,
          filePath: track.filePath,
          currentValue: '1. Song.mp3',
          proposedValue: '01. Song.mp3',
          reason: 'Single digit track number in filename',
        };
      }
      return null;
    },
  };

  beforeEach(() => {
    registry = new RuleRegistry();
    engine = new RulesEngine(registry);
  });

  describe('RuleRegistry', () => {
    it('initializes with default "all" preset', () => {
      const allPreset = registry.getPreset('all');
      expect(allPreset).toBeDefined();
      expect(allPreset?.name).toBe('All Rules');
      expect(allPreset?.ruleIds).toEqual([]);
    });

    it('registers rules and automatically updates "all" preset', () => {
      registry.registerRule(sampleZeroPadRule);

      expect(registry.getRule('test-zero-pad')).toBe(sampleZeroPadRule);
      expect(registry.getAllRules()).toHaveLength(1);
      expect(registry.getPreset('all')?.ruleIds).toContain('test-zero-pad');
    });

    it('unregisters rules from registry and presets', () => {
      registry.registerRule(sampleZeroPadRule);
      registry.unregisterRule('test-zero-pad');

      expect(registry.getRule('test-zero-pad')).toBeUndefined();
      expect(registry.getAllRules()).toHaveLength(0);
      expect(registry.getPreset('all')?.ruleIds).not.toContain('test-zero-pad');
    });

    it('registers and retrieves custom presets', () => {
      registry.registerRule(sampleZeroPadRule);

      const customPreset: RulePreset = {
        id: 'car-rules',
        name: 'Car USB Rules',
        ruleIds: ['test-zero-pad'],
      };
      registry.registerPreset(customPreset);

      expect(registry.getPreset('car-rules')).toEqual(customPreset);
      expect(registry.getRulesForPreset('car-rules')).toHaveLength(1);
    });
  });

  describe('RulesEngine Audit', () => {
    it('audits tracks and returns violations', () => {
      registry.registerRule(sampleZeroPadRule);

      const result = engine.audit([mockTrack1, mockTrack2]);

      expect(result.totalEvaluated).toBe(2);
      expect(result.violationCount).toBe(1);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].trackId).toBe('track-1');
      expect(result.violations[0].currentValue).toBe('1. Song.mp3');
      expect(result.violations[0].proposedValue).toBe('01. Song.mp3');
    });

    it('handles exceptions in a rule gracefully without aborting audit', () => {
      const brokenRule: Rule = {
        id: 'broken-rule',
        name: 'Broken Rule',
        description: 'Throws error',
        category: 'tag',
        evaluate: () => {
          throw new Error('Unexpected evaluation failure');
        },
      };

      registry.registerRule(brokenRule);
      registry.registerRule(sampleZeroPadRule);

      const result = engine.audit([mockTrack1]);

      // Should still finish audit and record violation from sampleZeroPadRule
      expect(result.totalEvaluated).toBe(1);
      expect(result.violationCount).toBe(1);
    });
  });

  describe('RulesEngine Batch Execution', () => {
    it('executes batch violations with progress updates', async () => {
      registry.registerRule(sampleZeroPadRule);
      const audit = engine.audit([mockTrack1]);

      const progressSteps: number[] = [];
      const applyMock = vi.fn().mockResolvedValue(undefined);

      const result = await engine.executeBatch(
        audit.violations,
        [mockTrack1],
        {
          onProgress: (p) => progressSteps.push(p.percent),
          applyViolation: applyMock,
        }
      );

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(applyMock).toHaveBeenCalledWith(audit.violations[0], mockTrack1);
      expect(progressSteps).toContain(100);
    });

    it('records failed violations and errors without crashing', async () => {
      registry.registerRule(sampleZeroPadRule);
      const audit = engine.audit([mockTrack1]);

      const applyMock = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const result = await engine.executeBatch(
        audit.violations,
        [mockTrack1],
        {
          applyViolation: applyMock,
        }
      );

      expect(result.success).toBe(false);
      expect(result.appliedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Permission denied');
    });
  });
});
