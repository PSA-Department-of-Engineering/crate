import React, { useEffect, useRef } from 'react';
import {
  Play,
  ListPlus,
  ListOrdered,
  Shuffle,
  Tag,
  Car,
  FileSpreadsheet,
  Copy,
  FolderOpen,
  Music,
  Disc,
} from 'lucide-react';
import { Track, ArtistGroup, AlbumGroup } from '../models/types';

export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

export interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  title?: string;
  subtitle?: string;
  items: MenuItem[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  title,
  subtitle,
  items,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape or Click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen || items.length === 0) return null;

  // Viewport clamping
  const menuWidth = 220;
  const menuHeightEstimate = items.length * 36 + (title ? 45 : 10);
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  let left = position.x;
  let top = position.y;

  if (left + menuWidth > screenWidth - 10) {
    left = Math.max(10, screenWidth - menuWidth - 10);
  }
  if (top + menuHeightEstimate > screenHeight - 10) {
    top = Math.max(10, screenHeight - menuHeightEstimate - 10);
  }

  return (
    <div
      ref={menuRef}
      style={{ left: `${left}px`, top: `${top}px` }}
      className="theme-popover fixed z-50 min-w-[210px] max-w-[280px] bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100 select-none text-xs"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Optional Header / Title */}
      {title && (
        <div className="px-3 py-1.5 border-b border-border/60 mb-1 flex flex-col">
          <span className="font-bold text-foreground truncate">{title}</span>
          {subtitle && (
            <span className="text-[10px] text-muted-foreground truncate">{subtitle}</span>
          )}
        </div>
      )}

      {/* Menu Items */}
      <div className="flex flex-col gap-0.5 px-1">
        {items.map((item) => (
          <React.Fragment key={item.id}>
            <button
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  onClose();
                }
              }}
              disabled={item.disabled}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                item.disabled
                  ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                  : item.danger
                  ? 'hover:bg-destructive/15 text-destructive hover:text-destructive font-medium'
                  : 'hover:bg-accent hover:text-accent-foreground text-foreground/90 font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                {item.icon && (
                  <span className="w-3.5 h-3.5 shrink-0 text-muted-foreground group-hover:text-foreground">
                    {item.icon}
                  </span>
                )}
                <span className="truncate">{item.label}</span>
              </div>
              {item.shortcut && (
                <span className="text-[10px] font-mono text-muted-foreground ml-2">
                  {item.shortcut}
                </span>
              )}
            </button>
            {item.divider && <div className="my-1 border-t border-border/50" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
