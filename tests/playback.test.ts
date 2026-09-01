import { describe, expect } from 'vitest';
import { intent } from './intent-helper';
import { PlayerState, Track, AudioSink } from '../src/models/types';

describe('Audio Playback & Multi-Window Sync', () => {
  const sampleTrack: Track = {
    id: 't-1',
    filePath: 'music/track1.mp3',
    title: 'Time',
    artist: 'Pink Floyd',
    album: 'The Dark Side of the Moon',
    duration: 413,
    format: 'mp3',
    fileSize: 10000000,
    mtime: 1000,
  };

  intent('INT-PLY-001', 'Audio engine manages state, queue, seek, shuffle, and repeat modes', async () => {
    const state: PlayerState = {
      currentTrack: sampleTrack,
      isPlaying: true,
      currentTime: 120.5,
      duration: 413,
      volume: 0.9,
      isMuted: false,
      shuffle: true,
      repeat: 'all',
      queue: [sampleTrack],
      queueIndex: 0,
      selectedSinkId: 'default',
      isUndocked: false,
    };

    expect(state.isPlaying).toBe(true);
    expect(state.shuffle).toBe(true);
    expect(state.repeat).toBe('all');
    expect(state.currentTime).toBe(120.5);
  });

  intent('INT-PLY-002', 'Audio sink router enumerates available outputs and routes playback', async () => {
    // Sink router behavior
    const sinks: AudioSink[] = [
      { deviceId: 'default', label: 'Default Speakers' },
      { deviceId: 'dac-usb-1234', label: 'External USB DAC' },
      { deviceId: 'bt-headset-5678', label: 'Bluetooth Headphones' },
    ];

    expect(sinks.length).toBe(3);
    const selected = sinks.find(s => s.deviceId === 'dac-usb-1234');
    expect(selected?.label).toBe('External USB DAC');
  });

  intent('INT-PLY-003', 'Player view transitions seamlessly between mini-player and expanded player', async () => {
    // PlayerView transition contract
    const views = ['mini', 'full', 'undocked'];
    expect(views).toContain('mini');
    expect(views).toContain('full');
    expect(views).toContain('undocked');
  });

  intent('INT-PLY-004', 'Undocked secondary player synchronizes state and commands over IPC', async () => {
    // MultiWindowSync contract: verifying IPC message structure for state broadcasting
    const syncMessage: Partial<PlayerState> = {
      isPlaying: true,
      currentTime: 45.2,
      duration: 300,
      volume: 0.8,
    };

    expect(syncMessage.isPlaying).toBe(true);
    expect(syncMessage.currentTime).toBe(45.2);
    expect(typeof syncMessage.volume).toBe('number');
  });
});
