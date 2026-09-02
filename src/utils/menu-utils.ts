import React from 'react';
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
} from 'lucide-react';
import { Track, ArtistGroup, AlbumGroup } from '../models/types';
import { MenuItem } from '../components/ContextMenu';

export interface ContextActionHandlers {
  onPlay: (tracks: Track[]) => void;
  onShuffle?: (tracks: Track[]) => void;
  onPlayNext: (tracks: Track[]) => void;
  onAddToQueue: (tracks: Track[]) => void;
  onEditTags: (tracks: Track[]) => void;
  onAddToSync?: (scope: 'all' | 'playlists' | 'albums', names?: string[], tracks?: Track[]) => void;
  onExportPlaylist?: (name: string, tracks: Track[]) => void;
  onRevealInExplorer?: (filePath: string) => void;
  onCopyPath?: (filePath: string) => void;
}

export function createArtistMenuItems(
  artist: ArtistGroup,
  handlers: ContextActionHandlers
): MenuItem[] {
  const tracks = artist.tracks;
  const sampleTrack = tracks[0];

  const items: MenuItem[] = [
    {
      id: 'play-artist',
      label: 'Play Artist',
      icon: React.createElement(Play, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onPlay(tracks),
    },
    {
      id: 'shuffle-artist',
      label: 'Shuffle Artist',
      icon: React.createElement(Shuffle, { className: 'w-3.5 h-3.5' }),
      onClick: () => {
        if (handlers.onShuffle) {
          handlers.onShuffle(tracks);
        } else {
          const shuffled = [...tracks].sort(() => Math.random() - 0.5);
          handlers.onPlay(shuffled);
        }
      },
    },
    {
      id: 'play-next-artist',
      label: 'Play Next',
      icon: React.createElement(ListPlus, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onPlayNext(tracks),
    },
    {
      id: 'add-queue-artist',
      label: 'Add to Queue',
      icon: React.createElement(ListOrdered, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onAddToQueue(tracks),
      divider: true,
    },
    {
      id: 'edit-artist-tags',
      label: 'Edit in Tag Editor',
      icon: React.createElement(Tag, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onEditTags(tracks),
    },
  ];

  if (handlers.onAddToSync) {
    items.push({
      id: 'sync-artist',
      label: 'Add to Car Sync',
      icon: React.createElement(Car, { className: 'w-3.5 h-3.5' }),
      onClick: () => {
        const albumNames = artist.albums.map((a) => a.albumName);
        handlers.onAddToSync!('albums', albumNames, tracks);
      },
      divider: !!(sampleTrack && handlers.onRevealInExplorer),
    });
  }

  if (sampleTrack && handlers.onRevealInExplorer) {
    items.push({
      id: 'reveal-artist',
      label: 'Reveal in File Explorer',
      icon: React.createElement(FolderOpen, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onRevealInExplorer!(sampleTrack.filePath),
    });
  }

  return items;
}

export function createAlbumMenuItems(
  album: AlbumGroup,
  handlers: ContextActionHandlers
): MenuItem[] {
  const tracks = album.tracks;
  const sampleTrack = tracks[0];

  const items: MenuItem[] = [
    {
      id: 'play-album',
      label: 'Play Album',
      icon: React.createElement(Play, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onPlay(tracks),
    },
    {
      id: 'shuffle-album',
      label: 'Shuffle Album',
      icon: React.createElement(Shuffle, { className: 'w-3.5 h-3.5' }),
      onClick: () => {
        if (handlers.onShuffle) {
          handlers.onShuffle(tracks);
        } else {
          const shuffled = [...tracks].sort(() => Math.random() - 0.5);
          handlers.onPlay(shuffled);
        }
      },
    },
    {
      id: 'play-next-album',
      label: 'Play Next',
      icon: React.createElement(ListPlus, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onPlayNext(tracks),
    },
    {
      id: 'add-queue-album',
      label: 'Add to Queue',
      icon: React.createElement(ListOrdered, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onAddToQueue(tracks),
      divider: true,
    },
    {
      id: 'edit-album-tags',
      label: 'Edit in Tag Editor',
      icon: React.createElement(Tag, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onEditTags(tracks),
    },
  ];

  if (handlers.onAddToSync) {
    items.push({
      id: 'sync-album',
      label: 'Add to Car Sync',
      icon: React.createElement(Car, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onAddToSync!('albums', [album.albumName], tracks),
    });
  }

  if (handlers.onExportPlaylist) {
    items.push({
      id: 'export-album-m3u',
      label: 'Export M3U Playlist',
      icon: React.createElement(FileSpreadsheet, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onExportPlaylist!(album.albumName, tracks),
      divider: !!(sampleTrack && handlers.onRevealInExplorer),
    });
  }

  if (sampleTrack && handlers.onRevealInExplorer) {
    items.push({
      id: 'reveal-album',
      label: 'Reveal in File Explorer',
      icon: React.createElement(FolderOpen, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onRevealInExplorer!(sampleTrack.filePath),
    });
  }

  return items;
}

export function createSongMenuItems(
  track: Track,
  handlers: ContextActionHandlers
): MenuItem[] {
  const items: MenuItem[] = [
    {
      id: 'play-song',
      label: 'Play Now',
      icon: React.createElement(Play, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onPlay([track]),
    },
    {
      id: 'play-next-song',
      label: 'Play Next',
      icon: React.createElement(ListPlus, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onPlayNext([track]),
    },
    {
      id: 'add-queue-song',
      label: 'Add to Queue',
      icon: React.createElement(ListOrdered, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onAddToQueue([track]),
      divider: true,
    },
    {
      id: 'edit-song-tags',
      label: 'Edit in Tag Editor',
      icon: React.createElement(Tag, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onEditTags([track]),
      divider: true,
    },
  ];

  if (handlers.onCopyPath) {
    items.push({
      id: 'copy-song-path',
      label: 'Copy File Path',
      icon: React.createElement(Copy, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onCopyPath!(track.filePath),
    });
  }

  if (handlers.onRevealInExplorer) {
    items.push({
      id: 'reveal-song',
      label: 'Reveal in File Explorer',
      icon: React.createElement(FolderOpen, { className: 'w-3.5 h-3.5' }),
      onClick: () => handlers.onRevealInExplorer!(track.filePath),
    });
  }

  return items;
}
