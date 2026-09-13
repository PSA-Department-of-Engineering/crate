import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Tag,
  Save,
  Image as ImageIcon,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Layers,
  FileMusic,
  ArrowLeft,
} from 'lucide-react';
import { Track, TagUpdates } from '../models/types';
import { hasDragData, getDragData } from '../utils/drag-utils';
import { isUnknownMetadataValue } from '../utils/organization-path';

interface TagEditorProps {
  selectedTracks: Track[];
  onSaveSingle: (filePath: string, tags: TagUpdates) => Promise<any>;
  onSaveBatch: (filePaths: string[], tags: TagUpdates) => Promise<any>;
  onDropTracks?: (tracks: Track[]) => void;
  onBackToLibrary?: () => void;
  allTracks?: Track[];
  existingArtists?: string[];
}

export const TagEditor: React.FC<TagEditorProps> = ({
  selectedTracks,
  onSaveSingle,
  onSaveBatch,
  onDropTracks,
  onBackToLibrary,
  allTracks,
  existingArtists,
}) => {
  const isBatch = selectedTracks.length > 1;
  const singleTrack = selectedTracks.length === 1 ? selectedTracks[0] : null;

  // Derive list of unique known artists for autocomplete suggestions
  const artistSuggestions = useMemo(() => {
    if (existingArtists && existingArtists.length > 0) {
      return existingArtists;
    }
    const sourceTracks = allTracks && allTracks.length > 0 ? allTracks : selectedTracks;
    const set = new Set<string>();
    for (const t of sourceTracks) {
      if (t.artist && t.artist.trim() && !isUnknownMetadataValue(t.artist)) {
        set.add(t.artist.trim());
      }
      if (t.albumArtist && t.albumArtist.trim() && !isUnknownMetadataValue(t.albumArtist)) {
        set.add(t.albumArtist.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [existingArtists, allTracks, selectedTracks]);

  const albumSuggestions = useMemo(() => {
    const sourceTracks = allTracks && allTracks.length > 0 ? allTracks : selectedTracks;
    const set = new Set<string>();
    for (const t of sourceTracks) {
      if (t.album && t.album.trim() && !isUnknownMetadataValue(t.album)) {
        set.add(t.album.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [allTracks, selectedTracks]);

  const albumArtistSuggestions = useMemo(() => {
    const set = new Set(artistSuggestions);
    set.add('Various Artists');
    return Array.from(set).sort((a, b) => {
      if (a === 'Various Artists') return -1;
      if (b === 'Various Artists') return 1;
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
  }, [artistSuggestions]);

  const [title, setTitle] = useState<string>('');
  const [artist, setArtist] = useState<string>('');
  const [album, setAlbum] = useState<string>('');
  const [albumArtist, setAlbumArtist] = useState<string>('');
  const [producer, setProducer] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [genre, setGenre] = useState<string>('');
  const [trackNumber, setTrackNumber] = useState<string>('');
  const [totalTracks, setTotalTracks] = useState<string>('');
  const [discNumber, setDiscNumber] = useState<string>('');
  const [totalDiscs, setTotalDiscs] = useState<string>('');
  const [artworkData, setArtworkData] = useState<string | null>(null);
  const [artworkFormat, setArtworkFormat] = useState<string>('image/jpeg');
  const [artworkChanged, setArtworkChanged] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (hasDragData(e)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const data = getDragData(e);
    if (data && data.tracks && data.tracks.length > 0 && onDropTracks) {
      onDropTracks(data.tracks);
    }
  };

  // Stable selection key representing the identities of the tracks being edited.
  // Using selection identity prevents playback timer ticks (which re-render the
  // player and top-level app) from wiping uncommitted edits while typing.
  const selectionKey = selectedTracks.map(t => `${t.id}:${t.filePath}`).join('|');
  const prevSelectionKeyRef = useRef<string | null>(null);

  // Sync state when selected tracks change
  useEffect(() => {
    if (prevSelectionKeyRef.current === selectionKey) {
      return;
    }
    prevSelectionKeyRef.current = selectionKey;

    setStatusMessage(null);
    setArtworkChanged(false);

    if (singleTrack) {
      setTitle(singleTrack.title || '');
      setArtist(singleTrack.artist || '');
      setAlbum(singleTrack.album || '');
      setAlbumArtist(singleTrack.albumArtist || '');
      setProducer(singleTrack.producer || '');
      setYear(singleTrack.year ? singleTrack.year.toString() : '');
      setGenre(singleTrack.genre || '');
      setTrackNumber(singleTrack.trackNumber ? singleTrack.trackNumber.toString() : '');
      setTotalTracks(singleTrack.totalTracks ? singleTrack.totalTracks.toString() : '');
      setDiscNumber(singleTrack.discNumber ? singleTrack.discNumber.toString() : '');
      setTotalDiscs(singleTrack.totalDiscs ? singleTrack.totalDiscs.toString() : '');

      let isSubscribed = true;
      if (singleTrack.picture) {
        setArtworkData(singleTrack.picture.data);
        setArtworkFormat(singleTrack.picture.format);
      } else {
        setArtworkData(null);
        if (typeof window !== 'undefined' && window.crateBridge?.getTrackArtwork && singleTrack.filePath) {
          window.crateBridge.getTrackArtwork(singleTrack.filePath).then(pic => {
            if (isSubscribed && pic) {
              setArtworkData(pic.data);
              setArtworkFormat(pic.format);
            }
          }).catch(err => {
            console.warn('Failed to load artwork for TagEditor:', err);
          });
        }
      }
      return () => {
        isSubscribed = false;
      };
    } else if (isBatch) {
      // Find common values across selected tracks
      const first = selectedTracks[0];
      const allSameArtist = selectedTracks.every(t => t.artist === first.artist);
      const allSameAlbum = selectedTracks.every(t => t.album === first.album);
      const allSameAlbumArtist = selectedTracks.every(t => t.albumArtist === first.albumArtist);
      const allSameProducer = selectedTracks.every(t => t.producer === first.producer);
      const allSameYear = selectedTracks.every(t => t.year === first.year);
      const allSameGenre = selectedTracks.every(t => t.genre === first.genre);

      setTitle('');
      setArtist(allSameArtist ? first.artist || '' : '');
      setAlbum(allSameAlbum ? first.album || '' : '');
      setAlbumArtist(allSameAlbumArtist ? first.albumArtist || '' : '');
      setProducer(allSameProducer ? first.producer || '' : '');
      setYear(allSameYear && first.year ? first.year.toString() : '');
      setGenre(allSameGenre ? first.genre || '' : '');
      setTrackNumber('');
      setTotalTracks('');
      setDiscNumber('');
      setTotalDiscs('');
      setArtworkData(null);
    }
  }, [selectionKey, singleTrack, isBatch, selectedTracks]);

  const handleArtworkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      setArtworkData(dataUri);
      setArtworkFormat(file.type || 'image/jpeg');
      setArtworkChanged(true);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveArtwork = () => {
    setArtworkData(null);
    setArtworkChanged(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTracks.length === 0) return;

    setIsSaving(true);
    setStatusMessage(null);

    const tagUpdates: TagUpdates = {};

    if (artist.trim()) tagUpdates.artist = artist.trim();
    if (album.trim()) tagUpdates.album = album.trim();
    if (albumArtist.trim()) tagUpdates.albumArtist = albumArtist.trim();
    // A blank producer is an explicit clear for a single track. In batch mode
    // an empty field means "leave each selected track unchanged" because the
    // field may be blank when the selected tracks have different credits.
    if (!isBatch || producer.trim()) tagUpdates.producer = producer.trim();
    if (year.trim()) {
      const y = parseInt(year.trim(), 10);
      if (!isNaN(y)) tagUpdates.year = y;
    }
    if (genre.trim()) tagUpdates.genre = genre.trim();

    if (!isBatch) {
      if (title.trim()) tagUpdates.title = title.trim();
      if (trackNumber.trim()) {
        const tn = parseInt(trackNumber.trim(), 10);
        if (!isNaN(tn)) tagUpdates.trackNumber = tn;
      }
      if (totalTracks.trim()) {
        const tt = parseInt(totalTracks.trim(), 10);
        if (!isNaN(tt)) tagUpdates.totalTracks = tt;
      }
      if (discNumber.trim()) {
        const dn = parseInt(discNumber.trim(), 10);
        if (!isNaN(dn)) tagUpdates.discNumber = dn;
      }
      if (totalDiscs.trim()) {
        const td = parseInt(totalDiscs.trim(), 10);
        if (!isNaN(td)) tagUpdates.totalDiscs = td;
      }
    }

    if (artworkChanged) {
      if (artworkData) {
        tagUpdates.picture = {
          format: artworkFormat,
          data: artworkData,
        };
      } else {
        tagUpdates.picture = null; // remove
      }
    }

    try {
      if (isBatch) {
        const paths = selectedTracks.map(t => t.filePath);
        await onSaveBatch(paths, tagUpdates);
        setStatusMessage({
          type: 'success',
          text: `Successfully updated tags for ${selectedTracks.length} tracks.`,
        });
      } else if (singleTrack) {
        await onSaveSingle(singleTrack.filePath, tagUpdates);
        setStatusMessage({
          type: 'success',
          text: `Successfully saved tags to ${tagUpdates.title || singleTrack.title}.`,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Error saving tags: ${err.message || 'Disk write failed'}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const backToLibraryButton = onBackToLibrary && (
    <button
      type="button"
      onClick={onBackToLibrary}
      disabled={isSaving}
      className="inline-flex items-center gap-2 shrink-0 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
      Back to Library
    </button>
  );

  if (selectedTracks.length === 0) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center flex-1 bg-card border rounded-xl m-4 p-8 text-center transition-all ${
          isDragOver
            ? 'border-primary border-2 border-dashed bg-primary/10 shadow-lg'
            : 'border-border text-muted-foreground'
        }`}
      >
        {backToLibraryButton}
        <div className={`p-4 rounded-2xl mb-3 transition-colors ${isDragOver ? 'bg-primary/20 text-primary animate-bounce' : 'bg-secondary text-primary/60'}`}>
          <Tag className="w-10 h-10" />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          {isDragOver ? 'Drop items to edit tags' : 'No Tracks Selected'}
        </h3>
        <p className="max-w-sm text-sm mt-1 text-muted-foreground">
          {isDragOver
            ? 'Release mouse to open this track or collection in the Tag Editor.'
            : 'Select tracks from the Library or drag and drop songs, albums, or artists here to view and edit tags.'}
        </p>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col flex-1 overflow-auto bg-card border rounded-xl shadow-sm m-4 p-6 transition-colors ${
        isDragOver ? 'border-primary ring-2 ring-primary/40' : 'border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4 mb-6">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isBatch ? (
            <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
              <Layers className="w-6 h-6" />
            </div>
          ) : (
            <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
              <FileMusic className="w-6 h-6" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground">
              {isBatch ? `Batch Tag Editor (${selectedTracks.length} tracks)` : `Edit Tags: ${singleTrack?.title}`}
            </h2>
            <p className="text-xs text-muted-foreground truncate" title={isBatch ? undefined : singleTrack?.filePath}>
              {isBatch
                ? 'Editing common fields across selected files. Edits write directly to file tags on disk.'
                : singleTrack?.filePath}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {statusMessage && (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
          {backToLibraryButton}
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        {/* Left Column: Artwork Management */}
        <div className="flex flex-col items-center p-4 bg-muted/30 rounded-xl border border-border">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 self-start">
            Embedded Artwork
          </h4>

          <div className="w-48 h-48 rounded-lg bg-secondary border-2 border-dashed border-border flex items-center justify-center overflow-hidden relative group">
            {artworkData ? (
              <img
                src={artworkData}
                alt="Cover Art"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center text-muted-foreground p-4 text-center">
                <ImageIcon className="w-10 h-10 mb-2 opacity-50 text-primary" />
                <span className="text-xs">No Embedded Artwork</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-4 w-full justify-center">
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium rounded-lg cursor-pointer border border-border transition-colors">
              <Upload className="w-3.5 h-3.5 text-primary" />
              <span>{artworkData ? 'Replace Image' : 'Add Cover Art'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleArtworkUpload}
                className="hidden"
              />
            </label>

            {artworkData && (
              <button
                type="button"
                onClick={handleRemoveArtwork}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-destructive/10 hover:bg-destructive text-destructive hover:text-destructive-foreground text-xs font-medium rounded-lg transition-colors"
                title="Remove Artwork"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 text-center">
            Embedded into APIC frames (MP3), PICTURE blocks (FLAC), or an id3 chunk (WAV).
          </p>
        </div>

        {/* Right 2 Columns: Metadata Fields Form */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {!isBatch && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Track Title
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. In the Flesh"
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Artist
              </label>
              <input
                type="text"
                list="tag-editor-artists-list"
                value={artist}
                onChange={e => setArtist(e.target.value)}
                placeholder={isBatch ? 'Keep existing / Mixed' : 'e.g. Pink Floyd'}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
              />
              <datalist id="tag-editor-artists-list">
                {artistSuggestions.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Album
              </label>
              <input
                type="text"
                list="tag-editor-albums-list"
                value={album}
                onChange={e => setAlbum(e.target.value)}
                placeholder={isBatch ? 'Keep existing / Mixed' : 'e.g. The Wall'}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
              />
              <datalist id="tag-editor-albums-list">
                {albumSuggestions.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Album Artist
                </label>
                <input
                  type="text"
                  list="tag-editor-album-artists-list"
                  value={albumArtist}
                  onChange={e => setAlbumArtist(e.target.value)}
                  placeholder="e.g. Various Artists"
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                />
                <datalist id="tag-editor-album-artists-list">
                  {albumArtistSuggestions.map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Producer
                </label>
                <input
                  type="text"
                  value={producer}
                  onChange={e => setProducer(e.target.value)}
                  placeholder="e.g. Quincy Jones"
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  placeholder="1979"
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Genre
                </label>
                <input
                  type="text"
                  value={genre}
                  onChange={e => setGenre(e.target.value)}
                  placeholder="Rock"
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                />
              </div>
            </div>
          </div>

          {!isBatch && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Track #
                  </label>
                  <input
                    type="number"
                    value={trackNumber}
                    onChange={e => setTrackNumber(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Total Tracks
                  </label>
                  <input
                    type="number"
                    value={totalTracks}
                    onChange={e => setTotalTracks(e.target.value)}
                    placeholder="12"
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Disc #
                  </label>
                  <input
                    type="number"
                    value={discNumber}
                    onChange={e => setDiscNumber(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Total Discs
                  </label>
                  <input
                    type="number"
                    value={totalDiscs}
                    onChange={e => setTotalDiscs(e.target.value)}
                    placeholder="2"
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="mt-auto pt-4 flex items-center justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Writing to Disk...' : isBatch ? 'Apply to Selected Files' : 'Save Tags'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
