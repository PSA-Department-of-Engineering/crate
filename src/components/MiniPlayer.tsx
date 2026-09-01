import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Maximize2,
  ExternalLink,
  Speaker,
  Music,
} from 'lucide-react';
import { PlayerState, AudioSink } from '../models/types';

interface MiniPlayerProps {
  state: PlayerState;
  availableSinks: AudioSink[];
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onSetVolume: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onSelectSink: (sinkId: string) => void;
  onExpandPlayer: () => void;
  onToggleUndock: () => void;
  isElectron: boolean;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  state,
  availableSinks,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onSetVolume,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onSelectSink,
  onExpandPlayer,
  onToggleUndock,
  isElectron,
}) => {
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentTrack = state.currentTrack;

  return (
    <div className="h-20 bg-card border-t border-border px-4 py-2 flex items-center justify-between gap-6 select-none shadow-lg z-20">
      {/* Left: Track Info & Thumbnail */}
      <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
        <div
          onClick={onExpandPlayer}
          className="w-12 h-12 rounded-lg bg-secondary border border-border flex items-center justify-center overflow-hidden shrink-0 cursor-pointer group relative shadow-inner"
        >
          {currentTrack?.picture ? (
            <img
              src={currentTrack.picture.data}
              alt="Art"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <Music className="w-5 h-5 text-primary opacity-60" />
          )}
          <div className="absolute inset-0 bg-foreground/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Maximize2 className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="flex flex-col overflow-hidden">
          <span
            onClick={onExpandPlayer}
            className="text-sm font-bold text-foreground truncate cursor-pointer hover:underline"
          >
            {currentTrack?.title || 'No Track Selected'}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {currentTrack ? `${currentTrack.artist} — ${currentTrack.album}` : 'Select a track to start playback'}
          </span>
        </div>
      </div>

      {/* Middle: Controls & Seek Timeline */}
      <div className="flex flex-col items-center flex-1 max-w-xl">
        <div className="flex items-center gap-3 mb-1.5">
          {/* Shuffle */}
          <button
            onClick={onToggleShuffle}
            className={`p-1.5 rounded-md hover:bg-secondary transition-colors ${
              state.shuffle ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
            }`}
            title={`Shuffle: ${state.shuffle ? 'On' : 'Off'}`}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Prev */}
          <button
            onClick={onPrev}
            disabled={!currentTrack}
            className="p-1.5 text-foreground hover:text-primary transition-colors disabled:opacity-40"
            title="Previous Track"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          {/* Play / Pause */}
          <button
            onClick={onTogglePlay}
            disabled={!currentTrack}
            className="p-2.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all hover:scale-105 disabled:opacity-40"
            title={state.isPlaying ? 'Pause' : 'Play'}
          >
            {state.isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={onNext}
            disabled={!currentTrack}
            className="p-1.5 text-foreground hover:text-primary transition-colors disabled:opacity-40"
            title="Next Track"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          {/* Repeat */}
          <button
            onClick={onCycleRepeat}
            className={`p-1.5 rounded-md hover:bg-secondary transition-colors ${
              state.repeat !== 'off' ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
            }`}
            title={`Repeat: ${state.repeat}`}
          >
            {state.repeat === 'one' ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Seek Bar */}
        <div className="w-full flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span>{formatTime(state.currentTime)}</span>
          <input
            type="range"
            min={0}
            max={state.duration || 100}
            step={0.5}
            value={state.currentTime}
            onChange={e => onSeek(parseFloat(e.target.value))}
            disabled={!currentTrack}
            className="flex-1 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
          />
          <span>{formatTime(state.duration)}</span>
        </div>
      </div>

      {/* Right: Volume & Sink Selector & Undock */}
      <div className="flex items-center justify-end gap-3 w-1/4 min-w-[200px]">
        {/* Output Sink Dropdown */}
        <div className="flex items-center gap-1.5 relative group">
          <Speaker className="w-4 h-4 text-muted-foreground" />
          <select
            value={state.selectedSinkId}
            onChange={e => onSelectSink(e.target.value)}
            className="text-xs bg-secondary border border-border rounded-md px-2 py-1 text-foreground focus:outline-none max-w-[120px] truncate"
            title="Audio Output Device"
          >
            {availableSinks.map(sink => (
              <option key={sink.deviceId} value={sink.deviceId}>
                {sink.label}
              </option>
            ))}
          </select>
        </div>

        {/* Volume Slider */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleMute}
            className="text-muted-foreground hover:text-foreground p-1"
            title={state.isMuted ? 'Unmute' : 'Mute'}
          >
            {state.isMuted || state.volume === 0 ? (
              <VolumeX className="w-4 h-4 text-destructive" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={state.isMuted ? 0 : state.volume}
            onChange={e => onSetVolume(parseFloat(e.target.value))}
            className="w-16 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
          />
        </div>

        {/* Expand / Undock */}
        {isElectron && (
          <button
            onClick={onToggleUndock}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
            title={state.isUndocked ? 'Dock Player' : 'Undock Player to Separate Window'}
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
