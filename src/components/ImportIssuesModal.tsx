import React from 'react';
import { X, AlertTriangle, FolderOpen } from 'lucide-react';

interface ImportIssuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  corruptFiles: string[];
  onShowInFolder?: (filePath: string) => void;
}

/**
 * Lists the files the last library scan could not read, each with a
 * "Show in folder" action so the user can find and repair or replace it.
 */
export const ImportIssuesModal: React.FC<ImportIssuesModalProps> = ({
  isOpen,
  onClose,
  corruptFiles,
  onShowInFolder,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-warning/10 text-warning rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Files That Could Not Be Read</h2>
              <p className="text-xs text-muted-foreground">
                These files were skipped during the library scan. They may be damaged, truncated, or not valid audio.
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

        {/* Content - one row per unreadable file */}
        <div className="p-6 overflow-y-auto space-y-2 flex-1">
          {corruptFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Every file in the library was read successfully.</p>
          ) : (
            corruptFiles.map((filePath) => (
              <div
                key={filePath}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors"
              >
                <span className="font-mono text-xs text-foreground break-all" title={filePath}>
                  {filePath}
                </span>
                {onShowInFolder && (
                  <button
                    type="button"
                    onClick={() => onShowInFolder(filePath)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg font-medium transition-colors"
                    title="Show in folder"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Show in folder
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {corruptFiles.length} {corruptFiles.length === 1 ? 'file' : 'files'} could not be read
          </span>
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
