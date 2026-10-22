// Frame-level helpers, shared by the join path and the sync relay. Kept separate so
// neither has to import the other.

import { WebSocket, type RawData } from 'ws';
import type { ServerControl } from '@shared/types';

/** Control messages travel as text. Binary frames are Yjs. */
export function sendControl(socket: WebSocket, message: ServerControl): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

export function sendBinary(socket: WebSocket, data: Uint8Array): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(data, { binary: true });
}

export function toBytes(data: RawData): Uint8Array {
  if (Buffer.isBuffer(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
  return new Uint8Array(data as ArrayBuffer);
}

/**
 * Decode a text frame. Must not go through toBytes: calling toString() on a
 * Uint8Array gives "123,34,116,…" rather than the decoded text, which silently
 * turns every control message into unparseable JSON.
 */
export function toText(data: RawData): string {
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data as ArrayBuffer).toString('utf8');
}
