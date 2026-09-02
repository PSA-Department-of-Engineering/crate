import React, { useState } from 'react';
import { version as appVersion } from '../../package.json';
import { BrandLogoMark } from './BrandLogo';
import {
  Music,
  Folder,
  Tag,
  Car,
  Disc,
  Search,
  ExternalLink,
  RefreshCw,
  Settings,
  Minus,
  Square,
  X,
  Radio,
} from 'lucide-react';
import { Track } from '../models/types';
import { hasDragData, getDragData } from '../utils/drag-utils';

interface HeaderProps {
  activeTab: 'library' | 'tageditor' | 'sync' | 'player' | 'webportal';
  setActiveTab: (tab: 'library' | 'tageditor' | 'sync' | 'player' | 'webportal') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenFolder?: () => void;
  onRevealFolder?: () => void;
  onRescan?: () => void;
  onOpenSettings?: () => void;
  libraryPath: string | null;
  isElectron: boolean;
  onUndockPlayer: () => void;
  onDropToTagEditor?: (tracks: Track[]) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  onOpenFolder,
  onRevealFolder,
  onRescan,
  onOpenSettings,
  libraryPath,
  isElectron,
  onUndockPlayer,
  onDropToTagEditor,
}) => {
  const [isTagEditorDragOver, setIsTagEditorDragOver] = useState(false);

  const handleWindowControl = (action: 'minimize' | 'maximize' | 'close') => {
    if (typeof window !== 'undefined' && window.crateBridge) {
      window.crateBridge.windowControl(action);
    }
  };

  const handleTagEditorDragOver = (e: React.DragEvent) => {
    if (hasDragData(e)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsTagEditorDragOver(true);
    }
  };

  const handleTagEditorDragLeave = () => {
    setIsTagEditorDragOver(false);
  };

  const handleTagEditorDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsTagEditorDragOver(false);
    const data = getDragData(e);
    if (data && data.tracks && data.tracks.length > 0 && onDropToTagEditor) {
      onDropToTagEditor(data.tracks);
    }
  };

  return (
    <header className="flex flex-col border-b border-border bg-card select-none">
      {/* Draggable Title Bar */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-border/50 app-draggable-region bg-muted/40">
        <div className="flex items-center gap-2 app-non-draggable-region">
          <BrandLogoMark className="w-5 h-5 rounded-md" />
          <span className="font-bold text-sm text-foreground tracking-tight">Crate</span>
          <span className="text-xs text-muted-foreground ml-1">v{appVersion}</span>
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
            onDragOver={handleTagEditorDragOver}
            onDragLeave={handleTagEditorDragLeave}
            onDrop={handleTagEditorDrop}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              isTagEditorDragOver
                ? 'bg-primary/30 ring-2 ring-primary text-primary-foreground scale-105 shadow-md animate-pulse'
                : activeTab === 'tageditor'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground/80 hover:bg-secondary hover:text-foreground'
            }`}
            title="Tag Editor (Drag items here to edit tags)"
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

          {/* Action Buttons: Undock, Fix, Folder, Settings */}
          <div className="flex items-center gap-1.5">
            {isElectron && (
              <button
                onClick={onUndockPlayer}
                className="p-2 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground rounded-lg border border-border transition-colors"
                title="Undock Mini Player to Floating Window"
                aria-label="Undock Mini Player"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}

            {onRescan && (
              <button
                onClick={onRescan}
                className="p-2 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground rounded-lg border border-border transition-colors"
                title="Fix & Rescan Library"
                aria-label="Fix & Rescan Library"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onRevealFolder || onOpenFolder}
              className="p-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg border border-border transition-colors"
              title="Open Music Folder in File Explorer"
              aria-label="Open Music Folder in File Explorer"
            >
              <Folder className="w-4 h-4 text-primary" />
            </button>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-2 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground rounded-lg border border-border transition-colors"
                title="Library & App Settings"
                aria-label="Library & App Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
