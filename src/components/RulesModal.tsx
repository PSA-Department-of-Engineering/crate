import React from 'react';
import { X, ShieldCheck, FileText, Tag, FolderTree, Trash2 } from 'lucide-react';
import { defaultRuleRegistry } from '../services/rules';
import { RuleCategory } from '../services/rules/types';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<RuleCategory, { label: string; color: string; icon: React.FC<{ className?: string }> }> = {
  filename: {
    label: 'Filename',
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    icon: FileText,
  },
  tag: {
    label: 'Metadata Tag',
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    icon: Tag,
  },
  structure: {
    label: 'Folder Structure',
    color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    icon: FolderTree,
  },
  cleanup: {
    label: 'Junk Cleanup',
    color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    icon: Trash2,
  },
};

const CATEGORY_ORDER: RuleCategory[] = ['filename', 'tag', 'structure', 'cleanup'];

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const rules = defaultRuleRegistry.getAllRules();
  const orderedRules = CATEGORY_ORDER.flatMap((category) =>
    rules.filter((rule) => rule.category === category)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">System Processing & Renaming Rules</h2>
              <p className="text-xs text-muted-foreground">
                Active rules registered for file standardization and car audio compatibility
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content - Clean list of rule names and categories */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No rules registered.</p>
          ) : (
            orderedRules.map((rule, idx) => {
              const cat = CATEGORY_LABELS[rule.category] || CATEGORY_LABELS.filename;
              const Icon = cat.icon;

              return (
                <div
                  key={rule.id}
                  className="flex items-start justify-between p-3.5 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="font-mono text-xs font-semibold text-muted-foreground/80 mt-0.5 w-5">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{rule.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                    </div>
                  </div>
                  <div className="shrink-0 ml-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${cat.color}`}
                    >
                      <Icon className="w-3 h-3" />
                      {cat.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>{rules.length} active rules configured in system</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
