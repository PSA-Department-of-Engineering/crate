const MAX_REMOTE_ARTWORK_BYTES = 10 * 1024 * 1024;
const REMOTE_ARTWORK_TIMEOUT_MS = 15_000;
const MAX_URL_RESOLUTION_HOPS = 5;

const NESTED_IMAGE_URL_KEYS = [
  'url',
  'u',
  'uri',
  'src',
  'source',
  'image',
  'image_url',
  'imageUrl',
  'img',
  'media',
  'media_url',
  'mediaUrl',
  'redirect',
  'redirect_url',
  'redirectUrl',
  'target',
  'target_url',
  'targetUrl',
  'destination',
  'dest',
  'download',
  'link',
  'href',
];

export interface ArtworkInput {
  format: string;
  data: string;
}

function sniffArtworkMime(bytes: Buffer): string | null {
  if (bytes.length >= 12 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) {
    return 'image/jpeg';
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  if (bytes.length >= 6 && (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a')) {
    return 'image/gif';
  }
  if (bytes.length >= 2 && bytes.subarray(0, 2).toString('ascii') === 'BM') {
    return 'image/bmp';
  }

  const text = bytes.subarray(0, Math.min(bytes.length, 16 * 1024)).toString('utf8').replace(/^\uFEFF/, '').trimStart();
  if (/<svg(?:\s|>)/i.test(text)) {
    return 'image/svg+xml';
  }

  return null;
}

function parseHttpUrl(value: string, baseUrl?: string): URL | null {
  let candidate = value.trim();
  if (!candidate) return null;

  // Query parameters and HTML attributes may be encoded more than once.
  for (let i = 0; i < 3; i++) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(candidate.replace(/&amp;/gi, '&'));
    } catch {
      break;
    }
    if (decoded === candidate) break;
    candidate = decoded;
  }

  try {
    const parsed = new URL(candidate, baseUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}

function findNestedImageUrl(pageUrl: URL): URL | null {
  const values: string[] = [];
  const seenKeys = new Set<string>();

  for (const key of NESTED_IMAGE_URL_KEYS) {
    seenKeys.add(key.toLowerCase());
    values.push(...pageUrl.searchParams.getAll(key));
  }

  // Some redirectors use an undocumented parameter name. Scanning remaining
  // values still only accepts explicit HTTP(S) URLs and never local schemes.
  for (const [key, value] of pageUrl.searchParams.entries()) {
    if (!seenKeys.has(key.toLowerCase())) values.push(value);
  }

  for (const value of values) {
    const nested = parseHttpUrl(value, pageUrl.href);
    if (nested && nested.href !== pageUrl.href) return nested;
  }
  return null;
}

function getHtmlAttribute(tag: string, attribute: string): string | null {
  const match = tag.match(new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match?.[1] || null;
}

function findImageUrlInHtml(html: string, baseUrl: string): URL | null {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    const property = (getHtmlAttribute(tag, 'property') || getHtmlAttribute(tag, 'name') || '').toLowerCase();
    if (!['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'].includes(property)) continue;

    const content = getHtmlAttribute(tag, 'content');
    const imageUrl = content ? parseHttpUrl(content, baseUrl) : null;
    if (imageUrl) return imageUrl;
  }

  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of linkTags) {
    const rel = (getHtmlAttribute(tag, 'rel') || '').toLowerCase().split(/\s+/);
    if (!rel.includes('image_src')) continue;

    const imageUrl = parseHttpUrl(getHtmlAttribute(tag, 'href') || '', baseUrl);
    if (imageUrl) return imageUrl;
  }

  return null;
}

/**
 * Downloads a user-provided HTTP(S) image so the renderer can crop it without
 * depending on remote CORS headers. The returned bytes are still normalized
 * to the car-safe JPEG by the renderer before they are embedded in audio tags.
 */
export async function fetchArtworkFromUrl(rawUrl: string): Promise<ArtworkInput> {
  const trimmedUrl = rawUrl.trim();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    throw new Error('Enter a valid image URL.');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Image URLs must use HTTP or HTTPS.');
  }

  let currentUrl = findNestedImageUrl(parsedUrl)?.href || parsedUrl.href;
  const visitedUrls = new Set<string>();

  for (let hop = 0; hop < MAX_URL_RESOLUTION_HOPS; hop++) {
    if (visitedUrls.has(currentUrl)) break;
    visitedUrls.add(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REMOTE_ARTWORK_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          // A number of image CDNs return a viewer/403 response to the
          // default Node user agent even though the same URL works in a
          // browser.
          'user-agent': 'Mozilla/5.0 (Crate cover art importer)',
        },
      });

      if (!response.ok) {
        throw new Error(`Image download failed (${response.status}).`);
      }

      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > MAX_REMOTE_ARTWORK_BYTES) {
        throw new Error('Image is larger than the 10 MB limit.');
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0) {
        throw new Error('The image URL returned an empty file.');
      }
      if (bytes.length > MAX_REMOTE_ARTWORK_BYTES) {
        throw new Error('Image is larger than the 10 MB limit.');
      }

      const mime = sniffArtworkMime(bytes);
      if (mime) {
        return {
          format: mime,
          data: `data:${mime};base64,${bytes.toString('base64')}`,
        };
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() || '';
      const isHtml = contentType.includes('text/html') || /<!doctype\s+html|<html\b|<meta\b|<img\b/i.test(bytes.toString('utf8', 0, Math.min(bytes.length, 128 * 1024)));
      if (isHtml) {
        const pageUrl = parseHttpUrl(response.url || currentUrl);
        const nestedUrl = pageUrl ? findNestedImageUrl(pageUrl) : null;
        const metadataImageUrl = findImageUrlInHtml(bytes.toString('utf8'), response.url || currentUrl);
        const nextUrl = nestedUrl || metadataImageUrl;
        if (nextUrl && !visitedUrls.has(nextUrl.href)) {
          currentUrl = nextUrl.href;
          continue;
        }
      }

      throw new Error('The URL did not return a supported image (PNG, JPG, SVG, WebP, GIF, or BMP), or an image page containing one.');
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('Image download timed out.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('The image URL could not be resolved after several redirects.');
}
