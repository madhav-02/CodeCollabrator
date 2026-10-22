// Modest caps so one bored person cannot exhaust the process (N7). None of these
// are security boundaries — the protection model is unguessable links.

import { LIMITS } from '@shared/types';
import type { Connection } from './rooms';
import { sendControl } from './wire';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Room creation per address. Keyed on the socket's own peer address, never on a
 * forwarded header — anyone can set those, which would make the limit decorative.
 * Behind a real proxy this needs revisiting alongside PUBLIC_ORIGIN.
 */
const creationsByAddress = new Map<string, number[]>();

/** Ceiling on the tracking map itself, so the limiter cannot become the leak. */
const MAX_TRACKED_ADDRESSES = 5_000;

function pruneAddresses(now: number): void {
  for (const [address, times] of creationsByAddress) {
    const live = times.filter((at) => now - at < HOUR_MS);
    if (live.length === 0) creationsByAddress.delete(address);
    else creationsByAddress.set(address, live);
  }
  // Only reachable under a spread-out flood; forgetting history is preferable to
  // growing without bound.
  if (creationsByAddress.size > MAX_TRACKED_ADDRESSES) creationsByAddress.clear();
}

export function allowRoomCreation(address: string): boolean {
  const now = Date.now();

  if (creationsByAddress.size > MAX_TRACKED_ADDRESSES / 2) pruneAddresses(now);

  const times = (creationsByAddress.get(address) ?? []).filter((at) => now - at < HOUR_MS);

  if (times.length >= LIMITS.roomsPerAddressPerHour) {
    creationsByAddress.set(address, times);
    return false;
  }

  times.push(now);
  creationsByAddress.set(address, times);
  return true;
}

/** Tell a connection something once, rather than on every offending message. */
export function warnOnce(conn: Connection, key: string, message: string): void {
  if (conn.warnings.has(key)) return;
  conn.warnings.add(key);
  sendControl(conn.socket, { t: 'rejected', message });
}

const RATE_WINDOW_MS = 1_000;

/** Caps total frames per second, so a runaway client cannot saturate the relay. */
export function allowMessage(conn: Connection): boolean {
  const now = Date.now();
  conn.msgTimes = conn.msgTimes.filter((at) => now - at < RATE_WINDOW_MS);

  if (conn.msgTimes.length >= LIMITS.messagesPerSecond) {
    warnOnce(conn, 'rate', 'Sending too fast; some changes were dropped.');
    return false;
  }

  conn.msgTimes.push(now);
  return true;
}

/**
 * Document size ceiling (R16).
 *
 * Measured in characters rather than encoded bytes, because the encoded size is
 * expensive to compute on every keystroke and the two are close enough for a
 * memory guard.
 *
 * Small updates are still accepted once over the limit, so the document can be cut
 * back down. Bulk inserts arrive as large updates and are refused, and the
 * per-second cap above stops the limit being nibbled past a character at a time.
 *
 * Be aware of what refusing an update costs. Yjs positions reference neighbouring
 * items, tombstones included, so once an update is refused every later edit from
 * that same client depends on data the server will never hold — those updates stay
 * pending indefinitely and that client is forked until it reloads. Other clients
 * are unaffected and can still trim the document. Hence the wording of the warning:
 * it tells the offender to reload rather than implying they can carry on.
 */
const SMALL_UPDATE_BYTES = 1_024;

export function allowDocumentWrite(
  conn: Connection,
  currentLength: number,
  updateBytes: number,
): boolean {
  if (currentLength < LIMITS.maxDocBytes) return true;
  if (updateBytes <= SMALL_UPDATE_BYTES) return true;

  warnOnce(
    conn,
    'docSize',
    'This document has hit its size limit. That change was not applied — reload the page to resync.',
  );
  return false;
}
