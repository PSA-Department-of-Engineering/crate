import { Track } from '../models/types';

export const CRATE_DRAG_MIME = 'application/x-crate-drag';

export type DragEntityType = 'track' | 'tracks' | 'album' | 'artist';

export interface CrateDragData {
  type: DragEntityType;
  trackIds: string[];
  tracks: Track[];
  title?: string;
  subtitle?: string;
}

/**
 * Attaches structured drag payload to a DragEvent dataTransfer object.
 */
export function setDragData(e: React.DragEvent | DragEvent, data: CrateDragData): void {
  if (!e.dataTransfer) return;

  const json = JSON.stringify(data);
  try {
    e.dataTransfer.setData(CRATE_DRAG_MIME, json);
  } catch {
    // Some browsers / environments restrict custom MIME types
  }
  e.dataTransfer.setData('application/json', json);

  const summary = data.title
    ? `${data.title} (${data.tracks.length} track${data.tracks.length === 1 ? '' : 's'})`
    : `${data.tracks.length} track${data.tracks.length === 1 ? '' : 's'}`;
  e.dataTransfer.setData('text/plain', summary);

  e.dataTransfer.effectAllowed = 'copyMove';
}

/**
 * Checks whether a DragEvent contains Crate-compatible drag data.
 */
export function hasDragData(e: React.DragEvent | DragEvent): boolean {
  if (!e.dataTransfer) return false;
  const types = Array.from(e.dataTransfer.types || []);
  return (
    types.includes(CRATE_DRAG_MIME) ||
    types.includes('application/json') ||
    types.includes('text/plain')
  );
}

/**
 * Parses and returns CrateDragData from a DragEvent dataTransfer object.
 */
export function getDragData(e: React.DragEvent | DragEvent): CrateDragData | null {
  if (!e.dataTransfer) return null;

  let raw = '';
  try {
    raw = e.dataTransfer.getData(CRATE_DRAG_MIME);
  } catch {
    raw = '';
  }

  if (!raw) {
    try {
      raw = e.dataTransfer.getData('application/json');
    } catch {
      raw = '';
    }
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.tracks) && Array.isArray(parsed.trackIds)) {
      return parsed as CrateDragData;
    }
  } catch (err) {
    console.warn('Failed to parse drag data payload:', err);
  }

  return null;
}
