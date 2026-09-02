import React, { useState, useEffect, useMemo } from 'react';
import { X, Wrench, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { Track } from '../models/types';
import { defaultRulesEngine, defaultRuleRegistry } from '../services/rules';
import { RuleViolation, BatchProgress } from '../services/rules/types';

interface FixModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  onRescanLibrary?: () => Promise<void>;
  onApplyViolation?: (violation: RuleViolation, track: Track) => Promise<void>;
}

export const FixModal: React.FC<FixModalProps> = ({
  isOpen,
  onClose,
  tracks,
  onRescanLibrary,
  onApplyViolation,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('all');
  const [isFixing, setIsFixing] = useState<boolean>(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [fixDone, setFixDone] = useState<boolean>(false);
  const [fixedCount, setFixedCount] = useState<number>(0);

  const presets = useMemo(() => defaultRuleRegistry.getAllPresets(), []);

  // Run audit against selected preset
  const auditResult = useMemo(() => {
    if (!isOpen) return null;
    return defaultRulesEngine.audit(tracks, selectedPreset);
  }, [isOpen, tracks, selectedPreset, fixDone]);

  const violations = auditResult?.violations || [];

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setIsFixing(false);
      setProgress(null);
      setFixDone(false);
      setFixedCount(0);
    }
  }, [isOpen]);

  const handleExecuteFix = async () => {
    if (violations.length === 0 || isFixing) return;

    setIsFixing(true);
    setProgress({
      current: 0,
      total: violations.length,
      percent: 0,
      currentViolation: violations[0],
    });

    try {
      const result = await defaultRulesEngine.executeBatch(
        violations,
        tracks,
        {
          onProgress: (p) => setProgress(p),
          applyViolation: onApplyViolation,
        }
      );

      setFixedCount(result.appliedCount);
      setFixDone(true);
      if (onRescanLibrary) {
        await onRescanLibrary();
      }
    } catch (err) {
      console.error('Failed to execute batch fixes:', err);
    } finally {
      setIsFixing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden">
        {/* Header with Preset Selector & Fix Action */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Library Fix & Standardization</h2>
              <p className="text-xs text-muted-foreground">
                Side-by-side diff of affected files and proposed rule outputs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Rules Preset Selector Button */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/80 border border-border rounded-lg text-xs">
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground font-medium">Preset:</span>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                disabled={isFixing}
                aria-label="Rules Preset"
                className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id} className="bg-card text-card-foreground">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Fix Action Button */}
            <button
              onClick={handleExecuteFix}
              disabled={violations.length === 0 || isFixing}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all ${
                violations.length > 0 && !isFixing
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105 active:scale-95'
                  : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
              }`}
            >
              {isFixing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Fixing...
                </>
              ) : (
                <>
                  <Wrench className="w-3.5 h-3.5" />
                  Fix {violations.length > 0 ? `(${violations.length})` : ''}
                </>
              )}
            </button>

            <button
              onClick={onClose}
              disabled={isFixing}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ml-1"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: 2 Identical Boxes Side-by-Side */}
        <div className="p-6 flex-1 grid grid-cols-2 gap-4 min-h-0 overflow-hidden bg-muted/10">
          {/* Left Box: Affected Items (Current) */}
          <div className="flex flex-col border border-border rounded-xl bg-card overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Affected Items (Current)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {violations.length} items
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border/60 p-2">
              {violations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-foreground">All items compliant</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No violations detected for active rules preset.
                  </p>
                </div>
              ) : (
                violations.map((v) => (
                  <div key={v.id} className="p-3 rounded-lg hover:bg-secondary/40 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        {v.ruleName}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-xs bg-muted/60 px-2 py-1 rounded border border-border/80 text-foreground truncate">
                      {v.currentValue}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                      {v.reason}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Box: Affected Items Output (Proposed Output) */}
          <div className="flex flex-col border border-border rounded-xl bg-card overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Affected Items Output (Fixed)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {violations.length} outputs
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border/60 p-2">
              {violations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-foreground">No changes needed</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your collection is already standardized.
                  </p>
                </div>
              ) : (
                violations.map((v) => (
                  <div key={v.id} className="p-3 rounded-lg hover:bg-secondary/40 transition-colors">
                    <div className="flex items-center gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Proposed Output
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-xs bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium truncate">
                      {v.proposedValue}
                    </div>
                    {v.proposedRenamePath && (
                      <p className="text-[10px] font-mono text-muted-foreground mt-1 truncate">
                        Path: {v.proposedRenamePath}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom Progress / Status Bar */}
        <div className="px-6 py-3.5 border-t border-border bg-card flex flex-col gap-2">
          {isFixing && progress && (
            <div className="space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span>Applying fix {progress.current} of {progress.total}</span>
                <span className="font-mono">{progress.percent}%</span>
              </div>
              <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-200 rounded-full"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground truncate font-mono">
                {progress.currentViolation.currentValue} → {progress.currentViolation.proposedValue}
              </p>
            </div>
          )}

          {!isFixing && fixDone && (
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Successfully fixed {fixedCount} items! All rules satisfied.</span>
              </div>
              <button
                onClick={onClose}
                className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-md transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {!isFixing && !fixDone && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {violations.length > 0
                  ? `${violations.length} items flagged for fixing under "${selectedPreset}" preset.`
                  : 'Library audit clean. Ready to play or sync.'}
              </span>
              <span className="text-[11px]">Audit duration: {auditResult?.durationMs || 0}ms</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
