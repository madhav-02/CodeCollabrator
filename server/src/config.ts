import { fileURLToPath } from 'node:url';

/**
 * Loopback by default (N9). Binding to 0.0.0.0 exposes rooms to everything on the
 * local network, so it has to be an explicit, deliberate choice.
 */
const host = process.env.HOST ?? '127.0.0.1';

export const config = {
  host,
  port: Number(process.env.PORT ?? 8787),
  production: process.env.NODE_ENV === 'production',
  /** Built client, served only in production. Vite serves it in development. */
  clientDir: fileURLToPath(new URL('../../client/dist', import.meta.url)),
} as const;

if (host !== '127.0.0.1' && host !== 'localhost') {
  console.warn(
    `[livecode] listening on ${host} — reachable beyond this machine. ` +
      'Rooms are protected only by unguessable links.',
  );
}
