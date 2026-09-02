import React, { useState, useMemo, useEffect } from 'react';
import {
  Play,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  Music,
  Disc,
  Clock,
  FolderOpen,
  FileAudio,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { Track, EmbeddedArtwork, ArtistGroup, AlbumGroup } from '../models/types';
import {
  groupTracksByArtist,
  groupTracksByAlbum,
  formatDuration,
  formatTotalPlaytime,
} from '../utils/library-utils';

interface LibraryMosaicProps {
  tracks: Track[];
  selectedTrackIds: string[];
  currentPlayingTrackId?: string;
  isPlaying: boolean;
  onSelectTrack: (trackId: string, multi: boolean) => void;
  onSelectAll: () => void;
  onPlayTrack: (track: Track, queue?: Track[]) => void;
  onOpenFolder?: () => void;
  libraryPath?: string | null;
  searchQuery?: string;
}

export const LibraryMosaic: React.FC<LibraryMosaicProps> = ({
  tracks,
  selectedTrackIds,
  currentPlayingTrackId,
  isPlaying,
  onSelectTrack,
  onPlayTrack,
  onOpenFolder,
  libraryPath,
  searchQuery,
}) => {
  const [selectedArtistName, setSelectedArtistName] = useState<string | null>(null);
  const [selectedAlbumName, setSelectedAlbumName] = useState<string | null>(null);

  // Group all provided (and search-filtered) tracks by artist
  const artistGroups = useMemo(() => {
    return groupTracksByArtist(tracks);
  }, [tracks]);

  // Current selected artist group
  const activeArtistGroup = useMemo(() => {
    if (!selectedArtistName) return null;
    return (
      artistGroups.find(
        (a) => a.artistName.toLowerCase() === selectedArtistName.toLowerCase()
      ) || null
    );
  }, [artistGroups, selectedArtistName]);

  // Current selected album group
  const activeAlbumGroup = useMemo(() => {
    if (!activeArtistGroup || !selectedAlbumName) return null;
    return (
      activeArtistGroup.albums.find(
        (alb) => alb.albumName.toLowerCase() === selectedAlbumName.toLowerCase()
      ) || null
    );
  }, [activeArtistGroup, selectedAlbumName]);

  // If search query changes or library changes and current selection is no longer valid, reset gracefully
  useEffect(() => {
    if (selectedArtistName && !activeArtistGroup) {
      // If the artist no longer exists in current filtered tracks, reset to root
      setSelectedArtistName(null);
      setSelectedAlbumName(null);
    } else if (selectedAlbumName && !activeAlbumGroup) {
      // If the album no longer exists, reset album
      setSelectedAlbumName(null);
    }
  }, [artistGroups, activeArtistGroup, activeAlbumGroup, selectedArtistName, selectedAlbumName]);

  const handleArtistClick = (artistName: string) => {
    setSelectedArtistName(artistName);
    setSelectedAlbumName(null);
  };

  const handleAlbumClick = (albumName: string) => {
    setSelectedAlbumName(albumName);
  };

  const handlePlayArtist = (e: React.MouseEvent, artist: ArtistGroup) => {
    e.stopPropagation();
    if (artist.tracks.length > 0) {
      onPlayTrack(artist.tracks[0], artist.tracks);
    }
  };

  const handlePlayAlbum = (e: React.MouseEvent, album: AlbumGroup) => {
    e.stopPropagation();
    if (album.tracks.length > 0) {
      onPlayTrack(album.tracks[0], album.tracks);
    }
  };

  const handleShuffleAlbum = (album: AlbumGroup) => {
    if (album.tracks.length > 0) {
      const shuffled = [...album.tracks].sort(() => Math.random() - 0.5);
      onPlayTrack(shuffled[0], shuffled);
    }
  };

  // Render a 2x2 artwork mosaic or single image for an artist card
  const renderArtistArtwork = (artist: ArtistGroup) => {
    const arts = artist.artworks;

    if (arts.length >= 4) {
      return (
        <div className="grid grid-cols-2 grid-rows-2 w-full h-full bg-secondary">
          {arts.slice(0, 4).map((art, idx) => (
            <img
              key={idx}
              src={art.data}
              alt=""
              className="w-full h-full object-cover"
            />
          ))}
        </div>
      );
    }

    if (arts.length === 2 || arts.length === 3) {
      return (
        <div className="grid grid-cols-2 w-full h-full bg-secondary">
          {arts.slice(0, 2).map((art, idx) => (
            <img
              key={idx}
              src={art.data}
              alt=""
              className="w-full h-full object-cover"
            />
          ))}
        </div>
      );
    }

    if (arts.length === 1) {
      return (
        <img
          src={arts[0].data}
          alt={artist.artistName}
          className="w-full h-full object-cover"
        />
      );
    }

    // Monogram / vinyl fallback
    const initials = artist.artistName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <div className="w-full h-full bg-gradient-to-br from-emerald-900/40 via-emerald-800/20 to-background flex flex-col items-center justify-center text-primary relative overflow-hidden">
        <Disc className="w-16 h-16 opacity-20 absolute -right-3 -bottom-3 rotate-12" />
        <span className="font-extrabold text-2xl tracking-widest text-primary/80 select-none">
          {initials || <Music className="w-8 h-8 opacity-60" />}
        </span>
      </div>
    );
  };

  // Render album artwork cover
  const renderAlbumArtwork = (album: AlbumGroup, sizeClass: string = 'w-full h-full') => {
    if (album.artwork?.data) {
      return (
        <img
          src={album.artwork.data}
          alt={album.albumName}
          className={`${sizeClass} object-cover`}
        />
      );
    }

    return (
      <div
        className={`${sizeClass} bg-gradient-to-br from-secondary via-muted to-background flex flex-col items-center justify-center text-muted-foreground relative overflow-hidden`}
      >
        <Disc className="w-12 h-12 text-primary/30" />
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Breadcrumb Navigation Bar */}
      <div className="px-6 py-3 bg-muted/20 border-b border-border flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-2">
          {(selectedArtistName || selectedAlbumName) && (
            <button
              onClick={() => {
                if (selectedAlbumName) {
                  setSelectedAlbumName(null);
                } else {
                  setSelectedArtistName(null);
                }
              }}
              className="p-1 rounded-md bg-secondary hover:bg-secondary/80 text-foreground mr-1 flex items-center gap-1 font-medium transition-colors"
              title="Go back"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          )}

          <button
            onClick={() => {
              setSelectedArtistName(null);
              setSelectedAlbumName(null);
            }}
            className={`font-semibold transition-colors ${
              !selectedArtistName
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Artists
          </button>

          {selectedArtistName && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
              <button
                onClick={() => setSelectedAlbumName(null)}
                className={`font-semibold truncate max-w-xs transition-colors ${
                  !selectedAlbumName
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {selectedArtistName}
              </button>
            </>
          )}

          {selectedAlbumName && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="font-semibold text-primary truncate max-w-xs">
                {selectedAlbumName}
              </span>
            </>
          )}
        </div>

        <div className="text-muted-foreground">
          {!selectedArtistName && (
            <span>
              <strong className="text-foreground">{artistGroups.length}</strong> artists &bull;{' '}
              <strong className="text-foreground">{tracks.length}</strong> tracks
            </span>
          )}
          {activeArtistGroup && !selectedAlbumName && (
            <span>
              <strong className="text-foreground">{activeArtistGroup.albums.length}</strong> albums &bull;{' '}
              <strong className="text-foreground">{activeArtistGroup.trackCount}</strong> tracks &bull;{' '}
              {formatTotalPlaytime(activeArtistGroup.totalDuration)}
            </span>
          )}
          {activeAlbumGroup && (
            <span>
              <strong className="text-foreground">{activeAlbumGroup.trackCount}</strong> tracks &bull;{' '}
              {formatTotalPlaytime(activeAlbumGroup.totalDuration)}
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Empty States */}
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            {!libraryPath ? (
              <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-4">
                <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                  <FolderOpen className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-foreground">No Music Folder Selected</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Open a local directory containing your MP3 or FLAC audio files to browse your artists, albums, and songs in mosaic view.
                  </p>
                </div>
                {onOpenFolder && (
                  <button
                    onClick={onOpenFolder}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg shadow-sm transition-colors mt-2"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>Open Music Folder</span>
                  </button>
                )}
              </div>
            ) : searchQuery ? (
              <div className="flex flex-col items-center justify-center space-y-2 py-8">
                <FileAudio className="w-10 h-10 opacity-40 text-primary" />
                <p className="text-sm">
                  No music found matching &ldquo;<strong className="text-foreground">{searchQuery}</strong>&rdquo;
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-2 py-8">
                <FileAudio className="w-10 h-10 opacity-40 text-primary" />
                <p className="text-sm">No audio tracks found in the selected folder.</p>
              </div>
            )}
          </div>
        ) : !selectedArtistName ? (
          /* Level 1: Artists Mosaic Grid */
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span>Artists</span>
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {artistGroups.map((artist) => (
                <div
                  key={artist.artistName}
                  onClick={() => handleArtistClick(artist.artistName)}
                  className="group flex flex-col bg-card hover:bg-muted/40 border border-border/80 hover:border-primary/50 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {/* Artist Artwork / Mosaic Container */}
                  <div className="aspect-square relative overflow-hidden bg-secondary">
                    {renderArtistArtwork(artist)}

                    {/* Hover Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={(e) => handlePlayArtist(e, artist)}
                        className="w-11 h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform"
                        title={`Play all songs by ${artist.artistName}`}
                      >
                        <Play className="w-5 h-5 fill-primary-foreground ml-0.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-3.5 flex flex-col">
                    <span className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {artist.artistName}
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {artist.albumCount} {artist.albumCount === 1 ? 'album' : 'albums'} &bull;{' '}
                      {artist.trackCount} {artist.trackCount === 1 ? 'track' : 'tracks'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !selectedAlbumName && activeArtistGroup ? (
          /* Level 2: Albums Grid for Selected Artist */
          <div>
            <div className="mb-5 flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                  {activeArtistGroup.artistName}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {activeArtistGroup.albumCount} {activeArtistGroup.albumCount === 1 ? 'album' : 'albums'} &bull;{' '}
                  {activeArtistGroup.trackCount} tracks &bull;{' '}
                  {formatTotalPlaytime(activeArtistGroup.totalDuration)}
                </p>
              </div>

              <button
                onClick={(e) => handlePlayArtist(e, activeArtistGroup)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg shadow-sm transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-primary-foreground" />
                <span>Play All</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {activeArtistGroup.albums.map((album) => (
                <div
                  key={album.albumName}
                  onClick={() => handleAlbumClick(album.albumName)}
                  className="group flex flex-col bg-card hover:bg-muted/40 border border-border/80 hover:border-primary/50 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {/* Album Cover Art */}
                  <div className="aspect-square relative overflow-hidden bg-secondary">
                    {renderAlbumArtwork(album)}

                    {/* Hover Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={(e) => handlePlayAlbum(e, album)}
                        className="w-11 h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform"
                        title={`Play album ${album.albumName}`}
                      >
                        <Play className="w-5 h-5 fill-primary-foreground ml-0.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-3.5 flex flex-col">
                    <span className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {album.albumName}
                    </span>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                      <span>{album.year || '—'}</span>
                      <span>{album.trackCount} {album.trackCount === 1 ? 'track' : 'tracks'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeAlbumGroup ? (
          /* Level 3: Album Detail & Songs View */
          <div className="space-y-6">
            {/* Album Header Banner */}
            <div className="flex flex-col md:flex-row items-start md:items-end gap-6 bg-card border border-border p-6 rounded-2xl shadow-sm">
              {/* Album Art (Large) */}
              <div className="w-40 h-40 md:w-48 md:h-48 rounded-xl overflow-hidden shadow-md border border-border/60 shrink-0 bg-secondary">
                {renderAlbumArtwork(activeAlbumGroup)}
              </div>

              {/* Album Metadata & Actions */}
              <div className="flex-1 flex flex-col justify-end space-y-3">
                <div className="space-y-1">
                  <span className="text-xs uppercase font-bold tracking-widest text-primary">
                    Album
                  </span>
                  <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                    {activeAlbumGroup.albumName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <button
                      onClick={() => setSelectedAlbumName(null)}
                      className="font-semibold text-foreground hover:text-primary transition-colors underline decoration-dotted"
                    >
                      {activeAlbumGroup.artistName}
                    </button>
                    {activeAlbumGroup.year && (
                      <>
                        <span>&bull;</span>
                        <span>{activeAlbumGroup.year}</span>
                      </>
                    )}
                    {activeAlbumGroup.genre && (
                      <>
                        <span>&bull;</span>
                        <span className="bg-secondary px-2 py-0.5 rounded text-xs">
                          {activeAlbumGroup.genre}
                        </span>
                      </>
                    )}
                    <span>&bull;</span>
                    <span>
                      {activeAlbumGroup.trackCount} {activeAlbumGroup.trackCount === 1 ? 'song' : 'songs'},{' '}
                      {formatTotalPlaytime(activeAlbumGroup.totalDuration)}
                    </span>
                  </div>
                </div>

                {/* Playback Controls */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={(e) => handlePlayAlbum(e, activeAlbumGroup)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-lg shadow-sm transition-colors"
                  >
                    <Play className="w-4 h-4 fill-primary-foreground" />
                    <span>Play Album</span>
                  </button>

                  <button
                    onClick={() => handleShuffleAlbum(activeAlbumGroup)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-secondary hover:bg-secondary/80 text-foreground text-sm font-semibold rounded-lg border border-border transition-colors"
                  >
                    <Shuffle className="w-4 h-4 text-muted-foreground" />
                    <span>Shuffle</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Songs / Tracklist Table */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-muted/40 border-b border-border text-xs uppercase tracking-wider font-semibold text-muted-foreground select-none">
                  <tr>
                    <th className="w-12 px-3 py-2.5 text-center">#</th>
                    <th className="px-4 py-2.5">Title</th>
                    <th className="px-4 py-2.5">Artist</th>
                    <th className="w-16 px-3 py-2.5 text-center">Fmt</th>
                    <th className="w-20 px-4 py-2.5 text-right">
                      <Clock className="w-3.5 h-3.5 inline mr-1" />
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {activeAlbumGroup.tracks.map((track, idx) => {
                    const isSelected = selectedTrackIds.includes(track.id);
                    const isCurrentlyPlaying = currentPlayingTrackId === track.id;

                    return (
                      <tr
                        key={track.id}
                        onClick={(e) => onSelectTrack(track.id, e.ctrlKey || e.metaKey || e.shiftKey)}
                        onDoubleClick={() => onPlayTrack(track, activeAlbumGroup.tracks)}
                        className={`group cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary/15 hover:bg-primary/20 text-foreground font-medium'
                            : isCurrentlyPlaying
                            ? 'bg-accent/40 text-accent-foreground font-medium'
                            : 'hover:bg-muted/50 text-foreground/90'
                        }`}
                      >
                        {/* Play icon or Track Number */}
                        <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                          {isCurrentlyPlaying ? (
                            <span className="text-primary font-bold animate-pulse">▶</span>
                          ) : (
                            <div className="relative flex items-center justify-center">
                              <span className="group-hover:hidden font-mono text-muted-foreground">
                                {track.trackNumber || idx + 1}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPlayTrack(track, activeAlbumGroup.tracks);
                                }}
                                className="hidden group-hover:flex items-center justify-center p-0.5 text-primary hover:scale-110"
                              >
                                <Play className="w-3.5 h-3.5 fill-primary" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Title */}
                        <td className="px-4 py-2.5 font-medium">
                          <div className="flex items-center gap-2">
                            {track.isCorrupt && (
                              <span title="Corrupt metadata">
                                <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                              </span>
                            )}
                            <span className="truncate">{track.title}</span>
                          </div>
                        </td>

                        {/* Artist */}
                        <td className="px-4 py-2.5 text-muted-foreground truncate">
                          {track.artist}
                        </td>

                        {/* Format */}
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                              track.format === 'flac'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {track.format}
                          </span>
                        </td>

                        {/* Duration */}
                        <td className="px-4 py-2.5 text-right text-xs font-mono text-muted-foreground">
                          {formatDuration(track.duration)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
