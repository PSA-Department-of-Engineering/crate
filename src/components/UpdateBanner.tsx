import React from 'react';
import { Download } from 'lucide-react';

export interface UpdateBannerProps {
  version: string;
  onRestart: () => void;
  onLater: () => void;
}

/**
 * Non-blocking notice shown once an update has finished downloading. Playback
 * is never interrupted: the update also installs on its own when the app quits.
 */
export const UpdateBanner: React.FC<UpdateBannerProps> = ({ version, onRestart, onLater }) => {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 px-4 py-2 bg-primary/10 border-b border-primary/20 text-xs select-none"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Download className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="font-semibold text-foreground truncate">Crate v{version} is ready to install.</span>
        <span className="text-muted-foreground truncate hidden sm:inline">
          It also installs automatically when you quit.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onLater}
          className="px-3 py-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg font-medium transition-colors"
        >
          Later
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold shadow-sm transition-colors"
        >
          Restart to update
        </button>
      </div>
    </div>
  );
};
