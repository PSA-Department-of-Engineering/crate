import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, Server } from 'node:http';
import { fetchArtworkFromUrl } from '../electron/services/artwork-input';

describe('Artwork URL input', () => {
  let server: Server;
  let baseUrl = '';

  beforeAll(async () => {
    server = createServer((request, response) => {
      if (request.url === '/cover.svg') {
        response.writeHead(200, { 'content-type': 'image/svg+xml' });
        response.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>');
        return;
      }
      if (request.url === '/image-page') {
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end('<html><head><meta property="og:image" content="' + baseUrl + '/cover.svg"></head></html>');
        return;
      }

      response.writeHead(200, { 'content-type': 'image/png' });
      response.end(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it('accepts raster and SVG image URLs and returns durable data URIs', async () => {
    const png = await fetchArtworkFromUrl(`${baseUrl}/cover.png`);
    expect(png.format).toBe('image/png');
    expect(png.data).toMatch(/^data:image\/png;base64,/);

    const svg = await fetchArtworkFromUrl(`${baseUrl}/cover.svg`);
    expect(svg.format).toBe('image/svg+xml');
    expect(svg.data).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('unwraps query-parameter redirectors and image pages', async () => {
    const directUrl = baseUrl + '/cover.png';
    const wrapped = baseUrl + '/redirect?url=' + encodeURIComponent(directUrl);
    const redirected = await fetchArtworkFromUrl(wrapped);
    expect(redirected.format).toBe('image/png');

    const page = await fetchArtworkFromUrl(baseUrl + '/image-page');
    expect(page.format).toBe('image/svg+xml');
  });

  it('rejects non-HTTP image sources before making a request', async () => {
    await expect(fetchArtworkFromUrl('file:///C:/cover.jpg')).rejects.toThrow('HTTP or HTTPS');
  });
});
