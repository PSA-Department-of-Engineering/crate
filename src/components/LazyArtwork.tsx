import React, { useEffect, useRef, useState } from 'react';
import { EmbeddedArtwork } from '../models/types';

const MAX_CONCURRENT_REQUESTS = 4;

type ArtworkRequest = {
  filePath: string;
  resolve: (artwork: EmbeddedArtwork | null) => void;
  reject: (error: unknown) => void;
};

// The artwork endpoint returns data URIs. Keep a small renderer-side cache so
// navigating artist -> album -> artist does not ask the main process for the
// same image again during one session.
const artworkCache = new Map<string, EmbeddedArtwork | null>();
const inFlightRequests = new Map<string, Promise<EmbeddedArtwork | null>>();
const requestQueue: ArtworkRequest[] = [];
let activeRequests = 0;

export function clearArtworkCache(): void {
  artworkCache.clear();
}

function pumpArtworkQueue(): void {
  while (activeRequests < MAX_CONCURRENT_REQUESTS && requestQueue.length > 0) {
    const request = requestQueue.shift()!;
    activeRequests += 1;

    const bridge = typeof window !== 'undefined' ? window.crateBridge : undefined;
    let work: Promise<EmbeddedArtwork | null>;
    try {
      work = bridge?.getTrackArtwork
        ? bridge.getTrackArtwork(request.filePath)
        : Promise.resolve(null);
    } catch (error) {
      activeRequests -= 1;
      request.reject(error);
      continue;
    }

    work
      .then((artwork) => {
        artworkCache.set(request.filePath, artwork);
        request.resolve(artwork);
      })
      .catch((error) => {
        request.reject(error);
      })
      .finally(() => {
        activeRequests -= 1;
        pumpArtworkQueue();
      });
  }
}

function requestArtwork(filePath: string): Promise<EmbeddedArtwork | null> {
  if (artworkCache.has(filePath)) {
    return Promise.resolve(artworkCache.get(filePath) ?? null);
  }

  const pending = inFlightRequests.get(filePath);
  if (pending) return pending;

  const request = new Promise<EmbeddedArtwork | null>((resolve, reject) => {
    requestQueue.push({ filePath, resolve, reject });
    pumpArtworkQueue();
  });

  inFlightRequests.set(filePath, request);
  // Always remove the promise after completion, including failures, so a
  // later visit can retry a temporarily unavailable file.
  request.finally(() => inFlightRequests.delete(filePath)).catch(() => {});
  return request;
}

interface LazyArtworkProps {
  filePath?: string;
  initialArtwork?: EmbeddedArtwork;
  alt: string;
  imageClassName: string;
  fallback: React.ReactNode;
  cacheGeneration?: number;
}

/**
 * Loads one track's artwork when its card approaches the viewport.
 * The wrapper preserves the card's dimensions while the image is loading.
 */
export const LazyArtwork: React.FC<LazyArtworkProps> = ({
  filePath,
  initialArtwork,
  alt,
  imageClassName,
  fallback,
  cacheGeneration = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [artwork, setArtwork] = useState<EmbeddedArtwork | null>(initialArtwork ?? null);
  const [isNearViewport, setIsNearViewport] = useState<boolean>(Boolean(initialArtwork));

  useEffect(() => {
    setArtwork(initialArtwork ?? null);
    setIsNearViewport(Boolean(initialArtwork));

    if (initialArtwork || !containerRef.current) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' }
    );
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [filePath, initialArtwork, cacheGeneration]);

  useEffect(() => {
    if (!isNearViewport || initialArtwork || !filePath) return;

    let isMounted = true;
    requestArtwork(filePath)
      .then((loadedArtwork) => {
        if (isMounted && loadedArtwork) setArtwork(loadedArtwork);
      })
      .catch(() => {
        // The fallback is the intended UI for missing or unreadable artwork.
      });

    return () => {
      isMounted = false;
    };
  }, [filePath, initialArtwork, cacheGeneration, isNearViewport]);

  return (
    <div ref={containerRef} className="w-full h-full">
      {artwork?.data ? (
        <img src={artwork.data} alt={alt} className={imageClassName} loading="lazy" />
      ) : (
        fallback
      )}
    </div>
  );
};
