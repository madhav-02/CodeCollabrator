// Yjs relay. The server holds the authoritative document for each room and passes
// updates between connections; it never interprets the code itself.
//
// Frames are split by type: binary carries the Yjs protocols, text carries our own
// control channel. That split is what lets T2.5 drop document changes from viewers
// while still letting them chat.

import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import { WebSocket, type RawData } from 'ws';
import type { Connection, Room } from './rooms';

export const MSG_SYNC = 0;
export const MSG_AWARENESS = 1;

function send(socket: WebSocket, data: Uint8Array): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(data, { binary: true });
}

export function toBytes(data: RawData): Uint8Array {
  if (Buffer.isBuffer(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
  return new Uint8Array(data as ArrayBuffer);
}

/** On arrival: ask what they have, and hand over the presence we know about. */
export function sendInitialSync(conn: Connection, room: Room): void {
  const sync = encoding.createEncoder();
  encoding.writeVarUint(sync, MSG_SYNC);
  syncProtocol.writeSyncStep1(sync, room.doc);
  send(conn.socket, encoding.toUint8Array(sync));

  const states = room.awareness.getStates();
  if (states.size > 0) {
    const presence = encoding.createEncoder();
    encoding.writeVarUint(presence, MSG_AWARENESS);
    encoding.writeVarUint8Array(
      presence,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, [...states.keys()]),
    );
    send(conn.socket, encoding.toUint8Array(presence));
  }
}

export function handleBinary(conn: Connection, room: Room, data: Uint8Array): void {
  const decoder = decoding.createDecoder(data);
  const type = decoding.readVarUint(decoder);

  if (type === MSG_SYNC) {
    const reply = encoding.createEncoder();
    encoding.writeVarUint(reply, MSG_SYNC);
    // The connection is the transaction origin, so the relay below knows not to
    // echo the update back to whoever sent it.
    syncProtocol.readSyncMessage(decoder, reply, room.doc, conn);
    // Length 1 means nothing beyond the type byte, so there is no reply to make.
    if (encoding.length(reply) > 1) send(conn.socket, encoding.toUint8Array(reply));
    return;
  }

  if (type === MSG_AWARENESS) {
    awarenessProtocol.applyAwarenessUpdate(room.awareness, decoding.readVarUint8Array(decoder), conn);
  }
}

function isConnection(value: unknown): value is Connection {
  return typeof value === 'object' && value !== null && 'awarenessIds' in value;
}

/** Wired once per room, at creation. */
export function attachRelay(room: Room): void {
  room.doc.on('update', (update: Uint8Array, origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const payload = encoding.toUint8Array(encoder);

    for (const conn of room.connections) {
      if (conn === origin) continue;
      send(conn.socket, payload);
    }
  });

  room.awareness.on(
    'update',
    (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      // Remember which presence ids belong to which connection, so they can be
      // cleared when that connection drops and their cursor does not linger.
      if (isConnection(origin)) {
        for (const id of [...added, ...updated]) origin.awarenessIds.add(id);
        for (const id of removed) origin.awarenessIds.delete(id);
      }

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, [...added, ...updated, ...removed]),
      );
      const payload = encoding.toUint8Array(encoder);

      for (const conn of room.connections) send(conn.socket, payload);
    },
  );
}

export function clearPresence(conn: Connection, room: Room): void {
  if (conn.awarenessIds.size === 0) return;
  awarenessProtocol.removeAwarenessStates(room.awareness, [...conn.awarenessIds], null);
}
