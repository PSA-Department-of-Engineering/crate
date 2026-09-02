import { Track } from '../../models/types';
import { RuleRegistry } from './RuleRegistry';
import {
  RuleViolation,
  RuleContext,
  RuleAuditResult,
  BatchProgress,
  RuleExecutionResult,
} from './types';

export class RulesEngine {
  private registry: RuleRegistry;

  constructor(registry?: RuleRegistry) {
    this.registry = registry || new RuleRegistry();
  }

  getRegistry(): RuleRegistry {
    return this.registry;
  }

  /**
   * Evaluates library tracks against a specified preset (defaults to 'all').
   * Returns a complete audit report with all detected violations.
   */
  audit(tracks: Track[], presetId: string = 'all', context?: RuleContext): RuleAuditResult {
    const startTime = performance.now();
    const rules = this.registry.getRulesForPreset(presetId);
    const violations: RuleViolation[] = [];

    const evalContext: RuleContext = {
      allTracks: tracks,
      ...context,
    };

    for (const track of tracks) {
      for (const rule of rules) {
        try {
          const violation = rule.evaluate(track, evalContext);
          if (violation) {
            violations.push(violation);
          }
        } catch (err) {
          console.error(`Error evaluating rule ${rule.id} on track ${track.filePath}:`, err);
        }
      }
    }

    return {
      violations,
      totalEvaluated: tracks.length,
      violationCount: violations.length,
      rulesEvaluated: rules.map(r => r.id),
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  /**
   * Executes fixes for violations with progress tracking.
   */
  async executeBatch(
    violations: RuleViolation[],
    tracks: Track[],
    handlers: {
      onProgress?: (progress: BatchProgress) => void;
      applyViolation?: (violation: RuleViolation, track: Track) => Promise<void>;
    } = {}
  ): Promise<RuleExecutionResult> {
    const trackMap = new Map(tracks.map(t => [t.id, t]));
    let appliedCount = 0;
    let failedCount = 0;
    const errors: Array<{ violationId: string; error: string }> = [];

    for (let i = 0; i < violations.length; i++) {
      const violation = violations[i];
      const track = trackMap.get(violation.trackId);

      if (handlers.onProgress) {
        handlers.onProgress({
          current: i + 1,
          total: violations.length,
          percent: Math.round(((i + 1) / violations.length) * 100),
          currentViolation: violation,
        });
      }

      try {
        if (handlers.applyViolation && track) {
          await handlers.applyViolation(violation, track);
        } else {
          const rule = this.registry.getRule(violation.ruleId);
          if (rule?.apply && track) {
            await rule.apply(track, violation);
          }
        }
        appliedCount++;
      } catch (err: any) {
        failedCount++;
        errors.push({
          violationId: violation.id,
          error: err?.message || String(err),
        });
      }
    }

    return {
      success: failedCount === 0,
      appliedCount,
      failedCount,
      errors,
    };
  }
}
