import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Minus,
  X,
  Music,
} from 'lucide-react';
import { PlayerState } from '../models/types';

export const UndockedMiniPlayer: React.FC = () => {
  const [state, setState] = useState<Partial<PlayerState>>({
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.85,
    isMuted: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.crateBridge) {
      const unsub = window.crateBridge.onPlayerState(synced => {
        setState(prev => ({ ...prev, ...synced }));
      });
      return unsub;
    }
  }, []);

  useEffect(() => {
    if (state.currentTrack && !state.currentTrack.picture && typeof window !== 'undefined' && window.crateBridge?.getTrackArtwork) {
      let isSubscribed = true;
      window.crateBridge.getTrackArtwork(state.currentTrack.filePath).then(picture => {
        if (isSubscribed && picture) {
          setState(prev => {
            if (prev.currentTrack) {
              return {
                ...prev,
                currentTrack: {
                  ...prev.currentTrack,
                  picture,
                },
              };
            }
            return prev;
          });
        }
      }).catch(() => {});
      return () => {
        isSubscribed = false;
      };
    }
  }, [state.currentTrack?.id]);

  const sendCommand = (action: string, payload?: any) => {
    if (typeof window !== 'undefined' && window.crateBridge) {
      window.crateBridge.sendPlayerState({ isPlaying: action === 'play' ? true : action === 'pause' ? false : state.isPlaying });
      // In electron main, player:command routes to main window
      const event = new CustomEvent('player-command', { detail: { action, payload } });
      window.dispatchEvent(event);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleWindowControl = (action: 'minimize' | 'close') => {
    if (typeof window !== 'undefined' && window.crateBridge) {
      window.crateBridge.windowControl(action);
    }
  };

  const currentTrack = state.currentTrack;

  return (
    <div className="w-full h-full bg-card border border-border flex flex-col justify-between p-3 select-none overflow-hidden app-draggable-region">
      {/* Mini Title Bar */}
      <div className="flex items-center justify-between pb-1 border-b border-border/40">
        <div className="flex items-center gap-1.5 app-non-draggable-region">
          <div className="w-4 h-4 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-[10px]">
            C
          </div>
          <span className="font-bold text-xs text-foreground">Crate Player</span>
        </div>

        <div className="flex items-center gap-1 app-non-draggable-region">
          <button
            onClick={() => handleWindowControl('minimize')}
            className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            onClick={() => handleWindowControl('close')}
            className="p-1 hover:bg-destructive hover:text-destructive-foreground rounded text-muted-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Track info & Controls */}
      <div className="flex items-center gap-3 py-1 app-non-draggable-region">
        <div className="w-12 h-12 rounded-lg bg-secondary border border-border flex items-center justify-center overflow-hidden shrink-0">
          {currentTrack?.picture ? (
            <img src={currentTrack.picture.data} alt="Art" className="w-full h-full object-cover" />
          ) : (
            <Music className="w-5 h-5 text-primary opacity-60" />
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="text-xs font-bold text-foreground truncate">
            {currentTrack?.title || 'No Track Selected'}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {currentTrack?.artist || 'Idle'}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => sendCommand('prev')}
            className="p-1.5 text-muted-foreground hover:text-foreground"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>
          <button
            onClick={() => sendCommand(state.isPlaying ? 'pause' : 'play')}
            className="p-2 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform"
          >
            {state.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <button
            onClick={() => sendCommand('next')}
            className="p-1.5 text-muted-foreground hover:text-foreground"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
        </div>
      </div>

      {/* Progress & Volume */}
      <div className="space-y-1 app-non-draggable-region">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
          <span>{formatTime(state.currentTime || 0)}</span>
          <span>{formatTime(state.duration || 0)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={state.duration || 100}
          step={0.5}
          value={state.currentTime || 0}
          onChange={e => sendCommand('seek', parseFloat(e.target.value))}
          className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
        />
      </div>
    </div>
  );
};
