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
  ListMusic,
  Disc3,
  Clock,
  Speaker,
} from 'lucide-react';
import { PlayerState, AudioSink, Track } from '../models/types';

interface FullPlayerProps {
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
  onPlayQueueItem: (track: Track, index: number) => void;
}

export const FullPlayer: React.FC<FullPlayerProps> = ({
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
  onPlayQueueItem,
}) => {
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentTrack = state.currentTrack;

  return (
    <div className="flex-1 overflow-auto bg-card border border-border rounded-xl shadow-sm m-4 p-8 flex flex-col md:flex-row gap-8 items-center justify-center">
      {/* Left: Artwork & Main Track Details */}
      <div className="flex flex-col items-center max-w-md w-full text-center">
        <div className="w-72 h-72 rounded-2xl bg-secondary border-2 border-border shadow-md overflow-hidden flex items-center justify-center relative mb-6">
          {currentTrack?.picture ? (
            <img
              src={currentTrack.picture.data}
              alt={currentTrack.album}
              className="w-full h-full object-cover"
            />
          ) : (
            <Disc3 className="w-24 h-24 text-primary opacity-40 animate-spin-slow" />
          )}
        </div>

        <h2 className="text-2xl font-extrabold text-foreground tracking-tight line-clamp-1">
          {currentTrack?.title || 'No Track Selected'}
        </h2>
        <p className="text-base font-semibold text-primary mt-1 line-clamp-1">
          {currentTrack?.artist || 'Unknown Artist'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
          {currentTrack?.album} {currentTrack?.year ? `(${currentTrack.year})` : ''}
        </p>

        {/* Format & Bitrate info */}
        {currentTrack && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs font-mono px-2 py-0.5 bg-secondary text-secondary-foreground rounded uppercase font-bold">
              {currentTrack.format}
            </span>
            {currentTrack.bitrate && (
              <span className="text-xs font-mono text-muted-foreground">
                {currentTrack.bitrate} kbps
              </span>
            )}
            {currentTrack.sampleRate && (
              <span className="text-xs font-mono text-muted-foreground">
                {currentTrack.sampleRate / 1000} kHz
              </span>
            )}
          </div>
        )}

        {/* Seek Bar */}
        <div className="w-full flex items-center gap-3 text-xs font-mono text-muted-foreground mt-6">
          <span>{formatTime(state.currentTime)}</span>
          <input
            type="range"
            min={0}
            max={state.duration || 100}
            step={0.5}
            value={state.currentTime}
            onChange={e => onSeek(parseFloat(e.target.value))}
            disabled={!currentTrack}
            className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
          />
          <span>{formatTime(state.duration)}</span>
        </div>

        {/* Large Controls */}
        <div className="flex items-center justify-center gap-6 mt-6">
          <button
            onClick={onToggleShuffle}
            className={`p-2 rounded-lg hover:bg-secondary transition-colors ${
              state.shuffle ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button
            onClick={onPrev}
            disabled={!currentTrack}
            className="p-3 text-foreground hover:text-primary transition-colors disabled:opacity-40"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>

          <button
            onClick={onTogglePlay}
            disabled={!currentTrack}
            className="p-4 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:scale-105 transition-all disabled:opacity-40"
          >
            {state.isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-1" />
            )}
          </button>

          <button
            onClick={onNext}
            disabled={!currentTrack}
            className="p-3 text-foreground hover:text-primary transition-colors disabled:opacity-40"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>

          <button
            onClick={onCycleRepeat}
            className={`p-2 rounded-lg hover:bg-secondary transition-colors ${
              state.repeat !== 'off' ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {state.repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
          </button>
        </div>

        {/* Output Device & Volume */}
        <div className="flex items-center justify-between w-full mt-6 pt-4 border-t border-border/60">
          <div className="flex items-center gap-2">
            <Speaker className="w-4 h-4 text-muted-foreground" />
            <select
              value={state.selectedSinkId}
              onChange={e => onSelectSink(e.target.value)}
              className="text-xs bg-secondary border border-border rounded-md px-2 py-1 text-foreground focus:outline-none"
            >
              {availableSinks.map(sink => (
                <option key={sink.deviceId} value={sink.deviceId}>
                  {sink.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onToggleMute} className="text-muted-foreground hover:text-foreground">
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
              className="w-24 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Right: Playback Queue */}
      <div className="flex flex-col flex-1 max-w-lg w-full h-[480px] bg-muted/20 border border-border rounded-xl p-4 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border pb-2.5 mb-3 text-sm font-bold text-foreground">
          <ListMusic className="w-4 h-4 text-primary" />
          <span>Playback Queue ({state.queue.length})</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/30">
          {state.queue.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Queue is empty. Double-click any track in the Library table to populate queue.
            </div>
          ) : (
            state.queue.map((track, idx) => {
              const isCurrent = state.queueIndex === idx;
              return (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => onPlayQueueItem(track, idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                    isCurrent
                      ? 'bg-primary/15 text-foreground font-bold'
                      : 'hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate flex-1">
                    <span className="font-mono w-4 text-center">
                      {isCurrent ? '▶' : idx + 1}
                    </span>
                    <div className="truncate">
                      <div className="truncate text-foreground font-medium">{track.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{track.artist}</div>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] ml-2 shrink-0">
                    {formatTime(track.duration)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
