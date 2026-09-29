import { useState, useEffect, useCallback } from 'react';
import { UpdateStatus } from '../models/types';

/**
 * Mirrors the main-process updater (INT-DIST-003) into React state. Outside the
 * desktop shell there is no bridge and `status` stays null.
 */
export function useAppUpdater() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  // "Later" only silences the prompt for that version; a newer download prompts again.
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.crateBridge : undefined;
    if (!bridge?.onUpdateStatus) return;

    let cancelled = false;
    let sawLiveStatus = false;

    const unsubscribe = bridge.onUpdateStatus(next => {
      sawLiveStatus = true;
      setStatus(next);
    });

    // Catch up on anything that happened before this window subscribed, unless a
    // live event has already superseded it.
    void bridge.getUpdateStatus?.().then(initial => {
      if (!cancelled && !sawLiveStatus) setStatus(initial);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    const next = await window.crateBridge?.checkForUpdates?.();
    if (next) setStatus(next);
  }, []);

  const installUpdate = useCallback(() => {
    void window.crateBridge?.installUpdate?.();
  }, []);

  const readyVersion = status?.state === 'ready' ? status.version : null;
  const showRestartPrompt = readyVersion !== null && readyVersion !== dismissedVersion;

  const dismissPrompt = useCallback(() => {
    if (readyVersion) setDismissedVersion(readyVersion);
  }, [readyVersion]);

  return { status, readyVersion, showRestartPrompt, checkForUpdates, installUpdate, dismissPrompt };
}
