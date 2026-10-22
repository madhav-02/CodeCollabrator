import { createReadStream, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { config } from './config';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    // Nothing here is cacheable and some of it will carry tokens later.
    'cache-control': 'no-store',
  });
  res.end(payload);
}

export function handleHttp(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', `http://${config.host}`);

  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, rooms: 0 });
    return;
  }

  // Room creation lands in T2.2.
  if (url.pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }

  if (!config.production) {
    sendJson(res, 404, {
      error: 'in development the client is served by vite on port 5173',
    });
    return;
  }

  serveClient(url.pathname, res);
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function serveClient(pathname: string, res: ServerResponse): void {
  const root = config.clientDir;
  const candidate = resolve(root, '.' + normalize(pathname));

  // Anything resolving outside the build directory is a traversal attempt. Checked
  // after resolve() so symlinks and `..` segments are already collapsed.
  const insideRoot = candidate === root || candidate.startsWith(root + sep);
  const hashedAsset = insideRoot && isFile(candidate);

  // Unknown paths fall through to index.html so client-side routes such as
  // /r/:roomId work on a cold load.
  const file = hashedAsset ? candidate : join(root, 'index.html');

  if (!isFile(file)) {
    sendJson(res, 500, { error: 'client build missing — run npm run build' });
    return;
  }

  res.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    // Asset filenames carry a content hash; index.html must never be cached.
    'cache-control': hashedAsset ? 'public, max-age=31536000, immutable' : 'no-store',
    'x-content-type-options': 'nosniff',
  });

  createReadStream(file).pipe(res);
}
