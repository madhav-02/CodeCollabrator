import { fileURLToPath } from 'node:url';
import { LIMITS } from '@shared/types';

/**
 * Loopback by default (N9). Binding to 0.0.0.0 exposes rooms to everything on the
 * local network, so it has to be an explicit, deliberate choice.
 */
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 8787);

export const config = {
  host,
  port,
  production: process.env.NODE_ENV === 'production',
  /** Origin the client is served from. Behind a proxy or domain, set this. */
  publicOrigin: process.env.PUBLIC_ORIGIN ?? `http://${host}:${port}`,
  /** Built client, served only in production. Vite serves it in development. */
  clientDir: fileURLToPath(new URL('../../client/dist', import.meta.url)),
  /**
   * How long a room survives after the last person leaves (R5). Overridable so the
   * expiry can be exercised without waiting an hour.
   */
  idleRoomMs: Number(process.env.IDLE_ROOM_MS ?? LIMITS.idleRoomMs),
} as const;

/** Checking more often than this buys nothing; less often delays cleanup. */
export const sweepIntervalMs = Math.max(1_000, Math.min(60_000, config.idleRoomMs / 2));

if (host !== '127.0.0.1' && host !== 'localhost') {
  console.warn(
    `[livecode] listening on ${host} — reachable beyond this machine. ` +
      'Rooms are protected only by unguessable links.',
  );
}
