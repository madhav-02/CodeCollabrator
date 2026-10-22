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
import { canWrite } from '@shared/types';
import type { Connection, Room } from './rooms';
import { sendBinary as send, sendControl } from './wire';

export const MSG_SYNC = 0;
export const MSG_AWARENESS = 1;

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

/** Connections already told once that they cannot write, to avoid log spam. */
const warned = new WeakSet<Connection>();

/**
 * The read-only rule, enforced here rather than in the browser (R18).
 *
 * The sync protocol has three kinds of message. A step-1 message only asks what
 * the server has, so it is safe for anyone. Step 2 and update both carry document
 * changes, so for a viewer they are dropped on the floor. Disabling the editor in
 * the browser is a courtesy; this is the control.
 */
function handleSync(conn: Connection, room: Room, decoder: decoding.Decoder): void {
  const kind = decoding.readVarUint(decoder);

  if (kind === syncProtocol.messageYjsSyncStep1) {
    const reply = encoding.createEncoder();
    encoding.writeVarUint(reply, MSG_SYNC);
    syncProtocol.readSyncStep1(decoder, reply, room.doc);
    send(conn.socket, encoding.toUint8Array(reply));
    return;
  }

  if (!canWrite(conn.role)) {
    if (!warned.has(conn)) {
      warned.add(conn);
      console.warn(`[livecode] room ${room.id}: dropped a write from viewer ${conn.name}`);
      sendControl(conn.socket, { t: 'rejected', message: 'You have view-only access.' });
    }
    return;
  }

  // The connection is the transaction origin, so the relay does not echo the
  // update back to whoever sent it.
  if (kind === syncProtocol.messageYjsSyncStep2) {
    syncProtocol.readSyncStep2(decoder, room.doc, conn);
  } else if (kind === syncProtocol.messageYjsUpdate) {
    syncProtocol.readUpdate(decoder, room.doc, conn);
  }
}

export function handleBinary(conn: Connection, room: Room, data: Uint8Array): void {
  const decoder = decoding.createDecoder(data);
  const type = decoding.readVarUint(decoder);

  if (type === MSG_SYNC) {
    handleSync(conn, room, decoder);
    return;
  }

  if (type === MSG_AWARENESS) {
    // Presence is allowed for every role, so a viewer still appears as present.
    // Whether they publish a cursor is a client-side choice (R30, T3.1); it only
    // affects visual noise, not the document.
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
