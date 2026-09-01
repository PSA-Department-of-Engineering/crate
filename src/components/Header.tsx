import React from 'react';
import { version as appVersion } from '../../package.json';
import {
  Music,
  FolderOpen,
  Tag,
  Car,
  Disc,
  Search,
  ExternalLink,
  Minus,
  Square,
  X,
  Radio
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'library' | 'tageditor' | 'sync' | 'player' | 'webportal';
  setActiveTab: (tab: 'library' | 'tageditor' | 'sync' | 'player' | 'webportal') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenFolder: () => void;
  libraryPath: string | null;
  isElectron: boolean;
  onUndockPlayer: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  onOpenFolder,
  libraryPath,
  isElectron,
  onUndockPlayer,
}) => {
  const handleWindowControl = (action: 'minimize' | 'maximize' | 'close') => {
    if (typeof window !== 'undefined' && window.crateBridge) {
      window.crateBridge.windowControl(action);
    }
  };

  return (
    <header className="flex flex-col border-b border-border bg-card select-none">
      {/* Draggable Title Bar */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-border/50 app-draggable-region bg-muted/40">
        <div className="flex items-center gap-2 app-non-draggable-region">
          <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
            C
          </div>
          <span className="font-bold text-sm text-foreground tracking-tight">Crate</span>
          <span className="text-xs text-muted-foreground ml-1">v{appVersion}</span>
          {libraryPath && (
            <span className="text-xs text-muted-foreground/80 truncate max-w-sm ml-2 bg-secondary px-2 py-0.5 rounded">
              {libraryPath}
            </span>
          )}
        </div>

        {/* Windows-style Frame Controls */}
        {isElectron && (
          <div className="flex items-center gap-1 app-non-draggable-region">
            <button
              onClick={() => handleWindowControl('minimize')}
              className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Minimize"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleWindowControl('maximize')}
              className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Maximize"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleWindowControl('close')}
              className="p-1.5 hover:bg-destructive hover:text-destructive-foreground rounded text-muted-foreground transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Navigation & Action Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'library'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground/80 hover:bg-secondary hover:text-foreground'
            }`}
          >
            <Music className="w-4 h-4" />
            Library
          </button>

          <button
            onClick={() => setActiveTab('tageditor')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'tageditor'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground/80 hover:bg-secondary hover:text-foreground'
            }`}
          >
            <Tag className="w-4 h-4" />
            Tag Editor
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'sync'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground/80 hover:bg-secondary hover:text-foreground'
            }`}
          >
            <Car className="w-4 h-4" />
            Car Sync
          </button>

          <button
            onClick={() => setActiveTab('player')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'player'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground/80 hover:bg-secondary hover:text-foreground'
            }`}
          >
            <Disc className="w-4 h-4" />
            Now Playing
          </button>

          <button
            onClick={() => setActiveTab('webportal')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'webportal'
                ? 'bg-secondary text-foreground font-bold'
                : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-primary" />
            Download Portal
          </button>
        </div>

        {/* Search Bar & Folder Action */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search artist, album, track, genre..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground/70"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={onOpenFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-lg border border-border transition-colors whitespace-nowrap"
            title="Choose Library Folder"
          >
            <FolderOpen className="w-4 h-4 text-primary" />
            <span>Open Folder</span>
          </button>

          {isElectron && (
            <button
              onClick={onUndockPlayer}
              className="p-2 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground rounded-lg border border-border transition-colors"
              title="Undock Mini Player to Floating Window"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
