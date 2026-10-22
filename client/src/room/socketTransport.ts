// WebSocket implementation of RoomTransport.
//
// Binary frames carry the Yjs protocols; text frames carry our control channel.
// Nothing above this file knows that, which is the point of the interface.

import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import { DOC, type ClientControl, type ServerControl } from '@shared/types';
import type { RoomSnapshot, RoomTransport, TransportOptions } from './transport';

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

/** Marks anything that arrived off the wire, so it is not sent straight back. */
const REMOTE = Symbol('remote');

interface AwarenessChange {
  added: number[];
  updated: number[];
  removed: number[];
}

export function createSocketTransport(opts: TransportOptions): RoomTransport {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  const meta = doc.getMap(DOC.meta);
  const listeners = new Set<() => void>();

  let snapshot: RoomSnapshot = {
    role: opts.role,
    status: 'connecting',
    participants: [],
    chat: [],
    language: opts.defaultLanguage,
    links: null,
    closed: null,
  };

  function update(patch: Partial<RoomSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }

  function publishPresence(role = snapshot.role): void {
    awareness.setLocalStateField('user', {
      userId: opts.me.userId,
      name: opts.me.name,
      color: opts.me.color,
      role,
    });
  }

  publishPresence();

  const params = new URLSearchParams({
    room: opts.roomId,
    token: opts.token,
    user: opts.me.userId,
    name: opts.me.name,
  });
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Same origin, so the server's origin check passes and dev needs no CORS.
  const socket = new WebSocket(`${scheme}//${location.host}/ws?${params.toString()}`);
  socket.binaryType = 'arraybuffer';

  function sendBinary(data: Uint8Array): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    // lib0 hands back Uint8Array<ArrayBufferLike>; send() wants a view over a plain
    // ArrayBuffer. lib0 never allocates on a SharedArrayBuffer, so the narrowing is
    // sound — the cast only satisfies the stricter DOM types.
    socket.send(data as Uint8Array<ArrayBuffer>);
  }

  function sendControl(message: ClientControl): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  socket.addEventListener('open', () => {
    update({ status: 'open' });

    const sync = encoding.createEncoder();
    encoding.writeVarUint(sync, MSG_SYNC);
    syncProtocol.writeSyncStep1(sync, doc);
    sendBinary(encoding.toUint8Array(sync));

    const presence = encoding.createEncoder();
    encoding.writeVarUint(presence, MSG_AWARENESS);
    encoding.writeVarUint8Array(presence, encodeAwarenessUpdate(awareness, [doc.clientID]));
    sendBinary(encoding.toUint8Array(presence));
  });

  function handleControl(message: ServerControl): void {
    switch (message.t) {
      case 'role':
        // The server's word, not the link's (R17).
        publishPresence(message.role);
        update({ role: message.role });
        break;
      case 'roster':
        update({ participants: message.users });
        break;
      case 'links':
        update({ links: { edit: message.edit, view: message.view } });
        break;
      case 'chatHistory':
        update({ chat: message.messages });
        break;
      case 'chat':
        update({ chat: [...snapshot.chat, message.message] });
        break;
      case 'closed':
        update({ closed: message.reason, status: 'closed' });
        break;
      case 'rejected':
        console.warn('[livecode] rejected:', message.message);
        break;
    }
  }

  socket.addEventListener('message', (event: MessageEvent) => {
    if (typeof event.data === 'string') {
      handleControl(JSON.parse(event.data) as ServerControl);
      return;
    }

    const decoder = decoding.createDecoder(new Uint8Array(event.data as ArrayBuffer));
    const type = decoding.readVarUint(decoder);

    if (type === MSG_SYNC) {
      const reply = encoding.createEncoder();
      encoding.writeVarUint(reply, MSG_SYNC);
      syncProtocol.readSyncMessage(decoder, reply, doc, REMOTE);
      if (encoding.length(reply) > 1) sendBinary(encoding.toUint8Array(reply));
      return;
    }

    if (type === MSG_AWARENESS) {
      applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), REMOTE);
    }
  });

  // Reconnection is T2.6; for now a dropped socket simply reports itself.
  socket.addEventListener('close', () => update({ status: 'closed' }));
  socket.addEventListener('error', () => update({ status: 'closed' }));

  const onDocUpdate = (payload: Uint8Array, origin: unknown): void => {
    if (origin === REMOTE) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, payload);
    sendBinary(encoding.toUint8Array(encoder));
  };
  doc.on('update', onDocUpdate);

  const onAwarenessUpdate = (change: AwarenessChange, origin: unknown): void => {
    if (origin === REMOTE) return;
    const changed = [...change.added, ...change.updated, ...change.removed];
    if (changed.length === 0) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(awareness, changed));
    sendBinary(encoding.toUint8Array(encoder));
  };
  awareness.on('update', onAwarenessUpdate);

  const onMeta = (): void => {
    const language = meta.get('language');
    if (typeof language === 'string') update({ language });
  };
  meta.observe(onMeta);

  return {
    doc,
    awareness,

    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    // Travels as a document change, so the server's viewer filter covers it (B2).
    setLanguage(name) {
      meta.set('language', name);
    },

    sendChat(text) {
      const trimmed = text.trim();
      if (trimmed) sendControl({ t: 'chat', text: trimmed });
    },

    promote: (userId) => sendControl({ t: 'promote', userId }),
    demote: (userId) => sendControl({ t: 'demote', userId }),
    remove: (userId) => sendControl({ t: 'remove', userId }),
    endRoom: () => sendControl({ t: 'end' }),
    requestLinks: () => sendControl({ t: 'links' }),

    destroy() {
      doc.off('update', onDocUpdate);
      awareness.off('update', onAwarenessUpdate);
      meta.unobserve(onMeta);
      listeners.clear();
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000);
      }
      awareness.destroy();
      doc.destroy();
    },
  };
}
