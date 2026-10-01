import React from 'react';
import { FolderOpen, Music, HardDrive, ShieldCheck, Loader2 } from 'lucide-react';
import { BrandLogoMark } from './BrandLogo';

interface OnboardingModalProps {
  isOpen: boolean;
  onSelectFolder: () => void;
  isScanning?: boolean;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onSelectFolder,
  isScanning = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-md select-none">
      <div className="w-full max-w-lg bg-card text-card-foreground border border-border shadow-2xl rounded-xl p-8 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Icon Header */}
        <div className="relative">
          <BrandLogoMark className="w-16 h-16 shadow-lg rounded-xl" />
        </div>

        {/* Title & Introduction */}
        <div className="space-y-2 max-w-sm">
          <h2 className="text-2xl font-black tracking-tight text-foreground">
            Welcome to Crate
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Select your music folder to get started. Crate will scan your MP3 and FLAC library, manage metadata, and prepare playlists for car sync.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="w-full grid grid-cols-3 gap-2.5 py-2 text-left">
          <div className="p-3 bg-secondary/50 border border-border/60 rounded-xl space-y-1">
            <Music className="w-4 h-4 text-primary" />
            <div className="text-xs font-bold text-foreground">MP3 & FLAC</div>
            <div className="text-[10px] text-muted-foreground leading-tight">Tags & cover art editing</div>
          </div>

          <div className="p-3 bg-secondary/50 border border-border/60 rounded-xl space-y-1">
            <HardDrive className="w-4 h-4 text-primary" />
            <div className="text-xs font-bold text-foreground">Car Sync</div>
            <div className="text-[10px] text-muted-foreground leading-tight">USB delta sync & M3U</div>
          </div>

          <div className="p-3 bg-secondary/50 border border-border/60 rounded-xl space-y-1">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <div className="text-xs font-bold text-foreground">100% Offline</div>
            <div className="text-[10px] text-muted-foreground leading-tight">Private & air-gapped</div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="w-full space-y-3 pt-1">
          <button
            onClick={onSelectFolder}
            disabled={isScanning}
            className="w-full py-3.5 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Scanning Music Collection...</span>
              </>
            ) : (
              <>
                <FolderOpen className="w-5 h-5" />
                <span>Select Music Folder</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-muted-foreground">
            Your folder selection is saved in AppData and can be changed anytime from the header.
          </p>
        </div>
      </div>
    </div>
  );
};
