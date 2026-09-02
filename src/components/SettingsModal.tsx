import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Folder,
  FolderOpen,
  Key,
  Eye,
  EyeOff,
  Save,
  Check,
  Loader2,
} from 'lucide-react';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  libraryPath: string | null;
  onChangeLibraryFolder: () => void;
  isScanning?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  libraryPath,
  onChangeLibraryFolder,
  isScanning = false,
}) => {
  const [spotifySecret, setSpotifySecret] = useState<string>('');
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load existing Spotify secret when modal opens
  useEffect(() => {
    let isMounted = true;
    const loadSettings = async () => {
      try {
        if (typeof window !== 'undefined' && window.crateBridge?.getSettings) {
          const settings = await window.crateBridge.getSettings();
          if (isMounted && settings?.spotifySecret) {
            setSpotifySecret(settings.spotifySecret);
            setIsSaved(true);
            return;
          }
        }
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          const localSecret = localStorage.getItem('crate_spotify_secret');
          if (isMounted && localSecret) {
            setSpotifySecret(localSecret);
            setIsSaved(true);
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };

    if (isOpen) {
      loadSettings();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleSaveSecret = async () => {
    setIsSaving(true);
    try {
      if (typeof window !== 'undefined' && window.crateBridge?.saveSettings) {
        await window.crateBridge.saveSettings({ spotifySecret });
      } else if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('crate_spotify_secret', spotifySecret);
      }
      setIsSaved(true);
    } catch (err) {
      console.error('Failed to save Spotify secret:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Settings</h2>
              <p className="text-xs text-muted-foreground">
                Manage library preferences and third-party integrations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Section 1: Library Folder */}
          <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-3">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Library Location</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The primary folder on disk where Crate scans, organizes, and manages your music collection.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border/80 bg-background/60">
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-medium text-muted-foreground block mb-0.5">
                  Current Directory
                </span>
                <span
                  className="text-xs font-mono text-foreground truncate block select-text"
                  title={libraryPath || 'No folder selected'}
                >
                  {libraryPath || 'No folder selected'}
                </span>
              </div>
              <button
                type="button"
                onClick={onChangeLibraryFolder}
                disabled={isScanning}
                className="flex items-center justify-center gap-2 px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 shrink-0"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Scanning...</span>
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Change Library Folder</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Spotify Integration */}
          <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-foreground">Spotify Integration</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Save your Spotify Client Secret to authenticate requests for upcoming metadata enrichment and playlist sync features.
            </p>

            <div className="space-y-2">
              <label className="block text-[11px] font-medium text-muted-foreground">
                Spotify Client Secret
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Enter or paste Spotify Client Secret..."
                    value={spotifySecret}
                    onChange={e => {
                      setSpotifySecret(e.target.value);
                      setIsSaved(false);
                    }}
                    className="w-full pl-3 pr-9 py-2 text-xs font-mono bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:font-sans placeholder:text-muted-foreground/70"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                    title={showSecret ? 'Hide secret' : 'Show secret'}
                    aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                  >
                    {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSaveSecret}
                  disabled={isSaving || !spotifySecret.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border disabled:opacity-50 text-xs font-semibold rounded-lg transition-colors shrink-0"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isSaved ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500">Saved</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>

              {isSaved && (
                <p className="text-[11px] text-emerald-500 flex items-center gap-1 mt-1 font-medium">
                  <Check className="w-3 h-3" /> Spotify secret saved locally
                </p>
              )}

              <p className="text-[10px] text-muted-foreground mt-1">
                Note: Verification and native OS vault storage will be enabled in future updates.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border bg-muted/20 flex items-center justify-end text-xs">
          <button
            type="button"
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
