import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Crop,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Save,
  Upload,
  X,
} from 'lucide-react';
import { EmbeddedArtwork } from '../models/types';
import { prepareImageForEditor } from '../utils/image-utils';

export type CoverArtScope = 'artist' | 'album';

interface CoverArtEditorModalProps {
  isOpen: boolean;
  scope: CoverArtScope;
  targetName: string;
  trackCount: number;
  initialArtwork?: EmbeddedArtwork;
  onClose: () => void;
  onSave: (artwork: EmbeddedArtwork) => Promise<void>;
}

interface ImageSize {
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

const PREVIEW_SIZE = 320;
const OUTPUT_SIZE = 500;
const MAX_OUTPUT_BYTES = 500 * 1024;
const MAX_INPUT_BYTES = 100 * 1024 * 1024;

function toDataUri(artwork: EmbeddedArtwork): string {
  return artwork.data.startsWith('data:')
    ? artwork.data
    : `data:${artwork.format};base64,${artwork.data}`;
}

function estimateDataUriBytes(dataUri: string): number {
  const commaIndex = dataUri.indexOf(',');
  if (commaIndex < 0) return Number.MAX_SAFE_INTEGER;
  return Math.ceil((dataUri.length - commaIndex - 1) * 3 / 4);
}

function getImageLayout(size: ImageSize | null, zoom: number, pan: Point) {
  if (!size || size.width <= 0 || size.height <= 0) return null;

  const baseScale = Math.max(PREVIEW_SIZE / size.width, PREVIEW_SIZE / size.height);
  const width = size.width * baseScale * zoom;
  const height = size.height * baseScale * zoom;
  const minX = PREVIEW_SIZE - width;
  const minY = PREVIEW_SIZE - height;

  return {
    width,
    height,
    x: Math.min(0, Math.max(minX, (PREVIEW_SIZE - width) / 2 + pan.x)),
    y: Math.min(0, Math.max(minY, (PREVIEW_SIZE - height) / 2 + pan.y)),
  };
}

function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read the selected image.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function loadImageFromUrl(url: string): Promise<{ data: string; format: string }> {
  return fetch(url)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Image download failed (${response.status}).`);
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) {
        throw new Error('The URL did not return an image.');
      }
      return {
        data: await readFileAsDataUri(new File([blob], 'cover', { type: blob.type })),
        format: blob.type,
      };
    });
}

export const CoverArtEditorModal: React.FC<CoverArtEditorModalProps> = ({
  isOpen,
  scope,
  targetName,
  trackCount,
  initialArtwork,
  onClose,
  onSave,
}) => {
  const [sourceData, setSourceData] = useState<string | null>(null);
  const [sourceFormat, setSourceFormat] = useState<string>('image/jpeg');
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [url, setUrl] = useState<string>('');
  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(false);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ start: Point; pan: Point } | null>(null);

  const layout = useMemo(() => getImageLayout(imageSize, zoom, pan), [imageSize, pan, zoom]);

  useEffect(() => {
    if (!isOpen) return;

    setSourceData(initialArtwork ? toDataUri(initialArtwork) : null);
    setSourceFormat(initialArtwork?.format || 'image/jpeg');
    setSourceLabel(initialArtwork ? 'Current cover' : '');
    setImageSize(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setUrl('');
    setIsLoadingUrl(false);
    setIsProcessingFile(false);
    setIsSaving(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [initialArtwork?.data, initialArtwork?.format, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving && !isProcessingFile) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, isProcessingFile, onClose]);

  if (!isOpen) return null;

  const subjectLabel = scope === 'artist' ? 'artist' : 'album';
  const trackLabel = `${trackCount} ${trackCount === 1 ? 'track' : 'tracks'}`;

  const setImageSource = (data: string, format: string, label: string) => {
    setSourceData(data);
    setSourceFormat(format || 'image/jpeg');
    setSourceLabel(label);
    setImageSize(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_INPUT_BYTES) {
      setErrorMessage('Choose an image smaller than 100 MB.');
      return;
    }

    setIsProcessingFile(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const prepared = await prepareImageForEditor(file);
      setImageSource(prepared.data, prepared.format, file.name);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Could not read the selected image.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleLoadUrl = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setErrorMessage('Enter an image URL first.');
      return;
    }

    setIsLoadingUrl(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const bridge = window.crateBridge;
      const artwork = bridge?.fetchArtworkFromUrl
        ? await bridge.fetchArtworkFromUrl(trimmedUrl)
        : await loadImageFromUrl(trimmedUrl);
      setImageSource(toDataUri(artwork), artwork.format, trimmedUrl);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Could not load that image URL.');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!layout || isSaving) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      start: { x: event.clientX, y: event.clientY },
      pan,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !layout) return;
    setPan({
      x: dragRef.current.pan.x + event.clientX - dragRef.current.start.x,
      y: dragRef.current.pan.y + event.clientY - dragRef.current.start.y,
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const createNormalizedArtwork = (): EmbeddedArtwork => {
    const image = imageRef.current;
    if (!image || !imageSize || !layout) {
      throw new Error('Choose an image and wait for its preview to finish loading.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot process cover images.');

    const outputScale = OUTPUT_SIZE / PREVIEW_SIZE;
    const drawWidth = layout.width * outputScale;
    const drawHeight = layout.height * outputScale;
    const drawX = layout.x * outputScale;
    const drawY = layout.y * outputScale;

    // JPEG has no alpha channel. White keeps transparent PNG/SVG artwork
    // readable instead of allowing the canvas default black background.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    let data = '';
    for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]) {
      data = canvas.toDataURL('image/jpeg', quality);
      if (estimateDataUriBytes(data) <= MAX_OUTPUT_BYTES) break;
    }

    if (!data || estimateDataUriBytes(data) > MAX_OUTPUT_BYTES) {
      throw new Error('The processed cover is still larger than the 500 KB car-safe limit.');
    }

    return { format: 'image/jpeg', data };
  };

  const handleSave = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);
    try {
      const artwork = createNormalizedArtwork();
      await onSave(artwork);
      setSuccessMessage(
        scope === 'artist'
          ? `Custom artist cover updated for ${targetName}.`
          : `Cover saved to ${trackLabel}.`
      );
      window.setTimeout(onClose, 450);
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          (scope === 'artist'
            ? 'Could not save the custom artist cover.'
            : 'Could not save the cover to the audio files.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cover-art-editor-title"
        className="theme-popover flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Crop className="h-5 w-5" />
              <h2 id="cover-art-editor-title" className="text-lg font-bold">
                Change {scope === 'artist' ? 'Artist' : 'Album'} Cover
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {scope === 'artist'
                ? `${targetName} · Updates Crate's custom artist cover without altering audio files or album artwork.`
                : `${targetName} · ${trackLabel} will receive the new embedded cover.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
            aria-label="Close cover editor"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-5 md:grid-cols-[320px_1fr]">
          <div className="flex flex-col gap-3">
            <div
              className={`relative aspect-square w-full select-none overflow-hidden rounded-xl border border-border bg-secondary ${
                layout ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              aria-label={layout ? 'Drag the image to choose the crop' : 'Cover preview'}
            >
              {sourceData && (
                <img
                  ref={imageRef}
                  src={sourceData}
                  alt="Cover crop preview"
                  onLoad={(event) => {
                    const image = event.currentTarget;
                    setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
                  }}
                  onError={() => {
                    setImageSize(null);
                    setErrorMessage('This file could not be decoded as an image.');
                  }}
                  className="pointer-events-none absolute max-w-none"
                  style={layout ? {
                    width: layout.width,
                    height: layout.height,
                    left: layout.x,
                    top: layout.y,
                  } : {
                    visibility: 'hidden',
                  }}
                />
              )}
              {!sourceData && (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
                  <ImageIcon className="h-12 w-12 text-primary/60" />
                  <span className="text-sm font-semibold">Choose a cover image</span>
                  <span className="text-xs">The square preview can be dragged and zoomed.</span>
                </div>
              )}
              {layout && (
                <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-white/80" />
              )}
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              Drag to crop · output is 500 × 500 JPEG, under 500 KB
            </p>
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="cover-zoom">
              Zoom
            </label>
            <input
              id="cover-zoom"
              type="range"
              min="1"
              max="2.5"
              step="0.01"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              disabled={!sourceData || isSaving}
              className="w-full accent-primary"
            />
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <section className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                <Upload className="h-4 w-4 text-primary" />
                Upload a picture
              </div>
              <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary/70 ${
                isProcessingFile ? 'cursor-not-allowed opacity-60' : ''
              }`}>
                {isProcessingFile ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Upload className="h-4 w-4 text-primary" />}
                <span>{isProcessingFile ? 'Optimizing photo…' : sourceData ? 'Choose another file' : 'Choose image file'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.svg,.webp,.gif,.bmp"
                  onChange={handleFileSelected}
                  disabled={isSaving || isProcessingFile}
                  className="hidden"
                />
              </label>
              <p className="mt-2 text-[11px] text-muted-foreground">
                PNG, JPG/JPEG, SVG, WebP, GIF, and BMP are accepted. Large photos are automatically optimized.
              </p>
            </section>

            <section className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                <LinkIcon className="h-4 w-4 text-primary" />
                Load from URL
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleLoadUrl();
                  }}
                  placeholder="https://example.com/cover.jpg"
                  disabled={isLoadingUrl || isSaving || isProcessingFile}
                  className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => void handleLoadUrl()}
                  disabled={isLoadingUrl || isSaving || isProcessingFile || !url.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoadingUrl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5" />}
                  Load
                </button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {scope === 'artist'
                  ? "The source is downloaded once, then stored in Crate's custom artist image library."
                  : 'The source is downloaded once, then the processed JPEG is stored in your music files.'}
              </p>
            </section>

            <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  {sourceData
                    ? scope === 'artist'
                      ? `Ready: ${sourceLabel || sourceFormat}. Drag the preview, adjust zoom, then save to display this custom artist artwork in Crate.`
                      : `Ready: ${sourceLabel || sourceFormat}. Drag the preview, adjust zoom, then save. All ${subjectLabel} tracks will carry this cover for car sync.`
                    : scope === 'artist'
                    ? `This will update the custom artist artwork displayed in Crate for ${targetName}. Individual album covers and song files will remain untouched.`
                    : `This will replace the embedded cover on all ${trackLabel} belonging to this ${subjectLabel}.`}
                </span>
              </div>
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="flex items-start gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isProcessingFile}
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!layout || isLoadingUrl || isSaving || isProcessingFile}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Saving to files…' : 'Save Cover'}
          </button>
        </div>
      </div>
    </div>
  );
};
