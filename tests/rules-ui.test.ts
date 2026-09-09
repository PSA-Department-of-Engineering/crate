import { describe, it, expect } from 'vitest';
import { defaultRuleRegistry, defaultRulesEngine } from '../src/services/rules';
import { Track } from '../src/models/types';

describe('Rules UI & Modals Integration (#37, #40, #44)', () => {
  const missingTrackNum: Track = {
    id: 'missing-track-num',
    filePath: 'C:/Music/Lil Uzi Vert/LUV Vs. The World 2/Myron.mp3',
    title: 'Myron',
    artist: 'Lil Uzi Vert',
    album: 'LUV Vs. The World 2',
    duration: 220,
    format: 'mp3',
    fileSize: 6000000,
    mtime: Date.now(),
    // trackNumber is undefined
  };

  const singleDigitTrack: Track = {
    id: 'single-digit-track',
    filePath: 'C:/Music/50 Cent/The Massacre/1. Intro.mp3',
    title: 'Intro',
    artist: '50 Cent',
    album: 'The Massacre',
    trackNumber: 1,
    duration: 41,
    format: 'mp3',
    fileSize: 1678666,
    mtime: Date.now(),
  };

  describe('#37 Fallback Track Number Flagging', () => {
    it('accurately identifies tracks needing visual fallback indication', () => {
      // Missing track number requires fallback to row index (idx + 1)
      expect(missingTrackNum.trackNumber).toBeUndefined();
      const isFallback = !missingTrackNum.trackNumber;
      expect(isFallback).toBe(true);

      // Track with valid metadata track number does not use fallback
      expect(singleDigitTrack.trackNumber).toBe(1);
      expect(!singleDigitTrack.trackNumber).toBe(false);
    });
  });

  describe('#40 & #44 Rules Registry & Overview Modal', () => {
    it('contains all registered rules for display in RulesModal', () => {
      const rules = defaultRuleRegistry.getAllRules();
      expect(rules.length).toBeGreaterThanOrEqual(6);

      const ruleIds = rules.map(r => r.id);
      expect(ruleIds).toContain('rule-zero-pad-track-number');
      expect(ruleIds).toContain('rule-enforce-track-number-filename');
      expect(ruleIds).toContain('rule-strip-promo-junk');
      expect(ruleIds).toContain('rule-multidisc-standardizer');
      expect(ruleIds).toContain('rule-filesystem-sanitize');
      expect(ruleIds).toContain('rule-companion-junk-cleanup');
      expect(ruleIds).toContain('rule-organize-by-metadata');
    });

    it('each rule has clean display name, category, and description', () => {
      const rules = defaultRuleRegistry.getAllRules();
      for (const rule of rules) {
        expect(rule.name).toBeTruthy();
        expect(rule.description).toBeTruthy();
        expect(['filename', 'tag', 'structure', 'cleanup']).toContain(rule.category);
      }
    });
  });

  describe('#44 Fix Modal Diff Data & Audit Integration', () => {
    it('produces side-by-side diff violations for FixModal display', () => {
      const audit = defaultRulesEngine.audit([singleDigitTrack]);
      expect(audit.violationCount).toBeGreaterThan(0);

      const v = audit.violations[0];
      // Left box: Affected items (Current)
      expect(v.currentValue).toBe('1. Intro.mp3');
      // Right box: Proposed output (Fixed)
      expect(v.proposedValue).toBe('01. Intro.mp3');
    });

    it('supports presets in FixModal (defaults to all)', () => {
      const presets = defaultRuleRegistry.getAllPresets();
      expect(presets.length).toBeGreaterThanOrEqual(1);
      expect(presets.find(p => p.id === 'all')).toBeDefined();

      const audit = defaultRulesEngine.audit([singleDigitTrack], 'all');
      expect(audit.rulesEvaluated.length).toBeGreaterThanOrEqual(6);
    });
  });
});
