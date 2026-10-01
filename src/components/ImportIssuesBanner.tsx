import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatImportSummary } from '../utils/library-utils';

export interface ImportIssuesBannerProps {
  trackCount: number;
  corruptCount: number;
  onViewFiles: () => void;
  onDismiss: () => void;
}

/**
 * Post-scan notice shown when some files could not be read. The scan itself
 * keeps going past unreadable files (INT-LIB-002); this tells the user so.
 */
export const ImportIssuesBanner: React.FC<ImportIssuesBannerProps> = ({
  trackCount,
  corruptCount,
  onViewFiles,
  onDismiss,
}) => {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs select-none"
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span className="font-semibold text-foreground truncate">
          {formatImportSummary(trackCount, corruptCount)}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onDismiss}
          className="px-3 py-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg font-medium transition-colors"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={onViewFiles}
          className="px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold shadow-sm transition-colors"
        >
          View files
        </button>
      </div>
    </div>
  );
};
