import { config } from './config';

// Vite serves the client from these during development.
const DEV_ORIGINS = ['http://127.0.0.1:5173', 'http://localhost:5173'];

export function allowedOrigins(): readonly string[] {
  return config.production ? [config.publicOrigin] : [config.publicOrigin, ...DEV_ORIGINS];
}

/**
 * Guards against cross-site WebSocket hijacking (N6).
 *
 * Ordinary HTTP requests from another site are held back by CORS, but a WebSocket
 * upgrade is not subject to it. Without this check any page a participant happened
 * to visit could open a socket to a room whose token their browser knows, and read
 * or write the document.
 *
 * A missing Origin header is refused as well. Browsers always send one on an
 * upgrade, so its absence means a non-browser client — which this app has no
 * legitimate use for.
 */
export function originAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  return allowedOrigins().includes(origin);
}
