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
  removeAwarenessStates,
} from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import { DOC, type ClientControl, type ServerControl } from '@shared/types';
import type { RoomSnapshot, RoomTransport, TransportOptions } from './transport';

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

/** Marks anything that arrived off the wire, so it is not sent straight back. */
const REMOTE = Symbol('remote');

const FIRST_RETRY_MS = 500;
const MAX_RETRY_MS = 10_000;

interface AwarenessChange {
  added: number[];
  updated: number[];
  removed: number[];
}

/** Exponential, capped, with jitter so many clients do not retry in lockstep. */
export function retryDelay(attempt: number): number {
  const base = Math.min(FIRST_RETRY_MS * 2 ** (attempt - 1), MAX_RETRY_MS);
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

export function createSocketTransport(opts: TransportOptions): RoomTransport {
  // The document outlives any individual socket. That is what makes a dropped
  // connection survivable: edits made while offline stay in the document and are
  // handed over during the next sync exchange (R11).
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  const meta = doc.getMap(DOC.meta);
  const listeners = new Set<() => void>();

  let socket: WebSocket | null = null;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;

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

  /** Some closes are final: no amount of retrying will help. */
  const isFinal = () => snapshot.closed !== null;

  // Mutable, because a rename must not require reconnecting.
  let myName = opts.me.name;

  function publishPresence(role = snapshot.role): void {
    awareness.setLocalStateField('user', {
      userId: opts.me.userId,
      name: myName,
      color: opts.me.color,
      role,
    });
  }

  publishPresence();

  function socketUrl(): string {
    const params = new URLSearchParams({
      room: opts.roomId,
      token: opts.token,
      user: opts.me.userId,
      // Read at call time, so a reconnect after a rename carries the new name.
      name: myName,
    });
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Same origin, so the server's origin check passes and dev needs no CORS.
    return `${scheme}//${location.host}/ws?${params.toString()}`;
  }

  function sendBinary(data: Uint8Array): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    // lib0 hands back Uint8Array<ArrayBufferLike>; send() wants a view over a plain
    // ArrayBuffer. lib0 never allocates on a SharedArrayBuffer, so the narrowing is
    // sound — the cast only satisfies the stricter DOM types.
    socket.send(data as Uint8Array<ArrayBuffer>);
  }

  function sendControl(message: ClientControl): void {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

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

  function handleBinary(buffer: ArrayBuffer): void {
    const decoder = decoding.createDecoder(new Uint8Array(buffer));
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
  }

  /**
   * Other people's cursors are meaningless while we are disconnected, and would
   * otherwise sit frozen on screen until the socket returned.
   */
  function dropRemotePresence(): void {
    const stale = [...awareness.getStates().keys()].filter((id) => id !== doc.clientID);
    if (stale.length > 0) removeAwarenessStates(awareness, stale, REMOTE);
  }

  function connect(): void {
    if (destroyed || isFinal()) return;

    update({ status: attempt === 0 ? 'connecting' : 'reconnecting' });

    const ws = new WebSocket(socketUrl());
    ws.binaryType = 'arraybuffer';
    socket = ws;

    ws.addEventListener('open', () => {
      attempt = 0;
      update({ status: 'open' });

      // Asking what the server has also prompts it to ask what we have, which is
      // how anything typed while offline gets delivered.
      const sync = encoding.createEncoder();
      encoding.writeVarUint(sync, MSG_SYNC);
      syncProtocol.writeSyncStep1(sync, doc);
      sendBinary(encoding.toUint8Array(sync));

      const presence = encoding.createEncoder();
      encoding.writeVarUint(presence, MSG_AWARENESS);
      encoding.writeVarUint8Array(presence, encodeAwarenessUpdate(awareness, [doc.clientID]));
      sendBinary(encoding.toUint8Array(presence));
    });

    ws.addEventListener('message', (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        handleControl(JSON.parse(event.data) as ServerControl);
      } else {
        handleBinary(event.data as ArrayBuffer);
      }
    });

    ws.addEventListener('close', () => {
      if (socket === ws) socket = null;
      dropRemotePresence();
      update({ participants: [] });

      if (destroyed || isFinal()) {
        update({ status: 'closed' });
        return;
      }

      attempt += 1;
      update({ status: 'reconnecting' });
      retryTimer = setTimeout(connect, retryDelay(attempt));
    });

    // A failed connection also fires close, which is where retrying is handled.
    ws.addEventListener('error', () => {});
  }

  connect();

  const onDocUpdate = (payload: Uint8Array, origin: unknown): void => {
    if (origin === REMOTE) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, payload);
    // Dropped on the floor while offline; the document keeps the change and the
    // next sync exchange carries it.
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

    rename(name) {
      const trimmed = name.trim();
      if (!trimmed || trimmed === myName) return;
      myName = trimmed;
      // The roster comes from the server, the cursor label from presence, so both
      // have to be told.
      publishPresence();
      sendControl({ t: 'rename', name: trimmed });
    },

    promote: (userId) => sendControl({ t: 'promote', userId }),
    demote: (userId) => sendControl({ t: 'demote', userId }),
    remove: (userId) => sendControl({ t: 'remove', userId }),
    endRoom: () => sendControl({ t: 'end' }),
    requestLinks: () => sendControl({ t: 'links' }),

    destroy() {
      destroyed = true;
      clearTimeout(retryTimer);
      doc.off('update', onDocUpdate);
      awareness.off('update', onAwarenessUpdate);
      meta.unobserve(onMeta);
      listeners.clear();
      if (socket && socket.readyState <= WebSocket.OPEN) socket.close(1000);
      socket = null;
      awareness.destroy();
      doc.destroy();
    },
  };
}
