import { useState, useEffect, useRef, useCallback } from 'react';
import { Track, PlayerState, RepeatMode, AudioSink } from '../models/types';

const INITIAL_STATE: PlayerState = {
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.85,
  isMuted: false,
  shuffle: false,
  repeat: 'off',
  queue: [],
  queueIndex: -1,
  selectedSinkId: 'default',
  isUndocked: false,
};

export function useAudioPlayer() {
  const [state, setState] = useState<PlayerState>(INITIAL_STATE);
  const [availableSinks, setAvailableSinks] = useState<AudioSink[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Audio Element
  useEffect(() => {
    const audio = new Audio();
    audio.volume = state.volume;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setState(prev => ({ ...prev, currentTime: audio.currentTime }));
    };

    const onLoadedMetadata = () => {
      setState(prev => ({
        ...prev,
        duration: audio.duration || prev.currentTrack?.duration || 0,
      }));
    };

    const onEnded = () => {
      handleNext();
    };

    const onError = (e: any) => {
      console.warn('Audio playback error', e);
      setState(prev => ({ ...prev, isPlaying: false }));
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Enumerate Audio Sinks
  const refreshAudioSinks = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices
          .filter(d => d.kind === 'audiooutput')
          .map(d => ({
            deviceId: d.deviceId || 'default',
            label: d.label || (d.deviceId === 'default' ? 'Default Output Device' : `Audio Device (${d.deviceId.slice(0, 8)})`),
          }));

        if (audioOutputs.length === 0) {
          audioOutputs.push({ deviceId: 'default', label: 'Default Audio Output' });
        }
        setAvailableSinks(audioOutputs);
      } catch {
        setAvailableSinks([{ deviceId: 'default', label: 'Default Audio Device' }]);
      }
    } else {
      setAvailableSinks([{ deviceId: 'default', label: 'Default Audio Device' }]);
    }
  }, []);

  useEffect(() => {
    refreshAudioSinks();
  }, [refreshAudioSinks]);

  // IPC listener for Undocked window state sync & commands
  useEffect(() => {
    if (typeof window !== 'undefined' && window.crateBridge) {
      const unsubState = window.crateBridge.onPlayerState((syncedState) => {
        setState(prev => ({ ...prev, ...syncedState }));
      });

      const unsubCmd = window.crateBridge.onPlayerCommand((cmd) => {
        if (cmd.action === 'play') playTrack();
        else if (cmd.action === 'pause') pause();
        else if (cmd.action === 'toggle') togglePlay();
        else if (cmd.action === 'next') handleNext();
        else if (cmd.action === 'prev') handlePrev();
        else if (cmd.action === 'seek' && typeof cmd.payload === 'number') seek(cmd.payload);
        else if (cmd.action === 'volume' && typeof cmd.payload === 'number') setVolume(cmd.payload);
      });

      return () => {
        unsubState();
        unsubCmd();
      };
    }
  }, []);

  // Sync state changes to secondary window via Bridge
  const broadcastState = useCallback((updates: Partial<PlayerState>) => {
    if (typeof window !== 'undefined' && window.crateBridge) {
      window.crateBridge.sendPlayerState(updates);
    }
  }, []);

  const playTrack = useCallback((track?: Track, newQueue?: Track[], index?: number) => {
    if (!audioRef.current) return;

    if (track) {
      const q = newQueue || state.queue;
      const qIdx = index !== undefined ? index : q.findIndex(t => t.id === track.id);

      // In Electron / local browser, resolve media source URL
      const srcUrl = track.filePath.startsWith('http') || track.filePath.startsWith('blob:')
        ? track.filePath
        : `file://${track.filePath}`;

      audioRef.current.src = srcUrl;
      audioRef.current.play().catch(() => {});

      const newState: Partial<PlayerState> = {
        currentTrack: track,
        isPlaying: true,
        currentTime: 0,
        queue: q,
        queueIndex: qIdx >= 0 ? qIdx : 0,
      };

      setState(prev => ({ ...prev, ...newState }));
      broadcastState(newState);

      // Lazy-load artwork on demand if not already loaded
      if (!track.picture && typeof window !== 'undefined' && window.crateBridge?.getTrackArtwork) {
        window.crateBridge.getTrackArtwork(track.filePath).then(picture => {
          if (picture) {
            setState(prev => {
              if (prev.currentTrack?.id === track.id) {
                const updatedTrack = { ...prev.currentTrack, picture };
                broadcastState({ currentTrack: updatedTrack });
                return { ...prev, currentTrack: updatedTrack };
              }
              return prev;
            });
          }
        }).catch(err => {
          console.warn('Failed to lazy-load track artwork:', err);
        });
      }
    } else if (state.currentTrack) {
      audioRef.current.play().catch(() => {});
      setState(prev => ({ ...prev, isPlaying: true }));
      broadcastState({ isPlaying: true });
    }
  }, [state.queue, state.currentTrack, broadcastState]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setState(prev => ({ ...prev, isPlaying: false }));
    broadcastState({ isPlaying: false });
  }, [broadcastState]);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      playTrack();
    }
  }, [state.isPlaying, pause, playTrack]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setState(prev => ({ ...prev, currentTime: time }));
    broadcastState({ currentTime: time });
  }, [broadcastState]);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    setState(prev => ({ ...prev, volume: clamped, isMuted: clamped === 0 }));
    broadcastState({ volume: clamped, isMuted: clamped === 0 });
  }, [broadcastState]);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    const nextMuted = !state.isMuted;
    audioRef.current.muted = nextMuted;
    setState(prev => ({ ...prev, isMuted: nextMuted }));
    broadcastState({ isMuted: nextMuted });
  }, [state.isMuted, broadcastState]);

  const toggleShuffle = useCallback(() => {
    setState(prev => {
      const nextShuffle = !prev.shuffle;
      broadcastState({ shuffle: nextShuffle });
      return { ...prev, shuffle: nextShuffle };
    });
  }, [broadcastState]);

  const cycleRepeat = useCallback(() => {
    setState(prev => {
      let nextRepeat: RepeatMode = 'off';
      if (prev.repeat === 'off') nextRepeat = 'all';
      else if (prev.repeat === 'all') nextRepeat = 'one';
      else nextRepeat = 'off';

      broadcastState({ repeat: nextRepeat });
      return { ...prev, repeat: nextRepeat };
    });
  }, [broadcastState]);

  const selectSink = useCallback(async (sinkId: string) => {
    if (audioRef.current && 'setSinkId' in audioRef.current) {
      try {
        await (audioRef.current as any).setSinkId(sinkId);
        setState(prev => ({ ...prev, selectedSinkId: sinkId }));
        broadcastState({ selectedSinkId: sinkId });
      } catch (err) {
        console.warn('Failed to set audio sink ID:', err);
      }
    } else {
      setState(prev => ({ ...prev, selectedSinkId: sinkId }));
    }
  }, [broadcastState]);

  const handleNext = useCallback(() => {
    if (state.queue.length === 0) return;

    if (state.repeat === 'one' && state.currentTrack) {
      seek(0);
      playTrack(state.currentTrack);
      return;
    }

    let nextIdx = state.queueIndex + 1;
    if (state.shuffle) {
      nextIdx = Math.floor(Math.random() * state.queue.length);
    }

    if (nextIdx >= state.queue.length) {
      if (state.repeat === 'all') {
        nextIdx = 0;
      } else {
        pause();
        return;
      }
    }

    const nextTrack = state.queue[nextIdx];
    if (nextTrack) {
      playTrack(nextTrack, state.queue, nextIdx);
    }
  }, [state.queue, state.queueIndex, state.repeat, state.shuffle, state.currentTrack, seek, playTrack, pause]);

  const handlePrev = useCallback(() => {
    if (state.currentTime > 3 || state.queueIndex <= 0) {
      seek(0);
      return;
    }

    const prevIdx = state.queueIndex - 1;
    const prevTrack = state.queue[prevIdx];
    if (prevTrack) {
      playTrack(prevTrack, state.queue, prevIdx);
    }
  }, [state.currentTime, state.queueIndex, state.queue, seek, playTrack]);

  const toggleUndock = useCallback(async () => {
    if (typeof window !== 'undefined' && window.crateBridge) {
      if (state.isUndocked) {
        await window.crateBridge.dockPlayer();
        setState(prev => ({ ...prev, isUndocked: false }));
      } else {
        await window.crateBridge.undockPlayer();
        setState(prev => ({ ...prev, isUndocked: true }));
      }
    }
  }, [state.isUndocked]);

  return {
    state,
    availableSinks,
    playTrack,
    pause,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    selectSink,
    handleNext,
    handlePrev,
    toggleUndock,
    refreshAudioSinks,
  };
}
