// Offline implementation of RoomTransport: a local Yjs document, no network.
// Lets the room screen be built and exercised before the server exists (T1.7).
// Replaced wholesale by the WebSocket implementation in T2.4.

import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { COLORS, type ChatMessage, type Participant, type Role } from '@shared/types';
import { randomId } from '../lib/ids';
import type { RoomSnapshot, RoomTransport, TransportOptions } from './transport';

/**
 * Two stand-in participants, so the roster and host controls can be built and seen
 * without a second browser. Obviously labelled; they disappear in Phase 2.
 */
function demoParticipants(): Participant[] {
  return [
    { userId: 'demo-ana', name: 'Ana (demo)', color: COLORS[1], role: 'editor' },
    { userId: 'demo-raj', name: 'Raj (demo)', color: COLORS[2], role: 'viewer' },
  ];
}

export function createOfflineTransport(opts: TransportOptions): RoomTransport {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  const meta = doc.getMap('meta');
  const listeners = new Set<() => void>();

  if (!meta.has('language')) meta.set('language', opts.defaultLanguage);

  const me: Participant = { ...opts.me, role: opts.role };

  let snapshot: RoomSnapshot = {
    role: opts.role,
    status: 'open',
    participants: [me, ...demoParticipants()],
    chat: [],
    language: opts.defaultLanguage,
    links: null,
    closed: null,
  };

  function update(patch: Partial<RoomSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }

  // Presence for the collaborative cursor layer. Viewers publish no cursor (R30),
  // which T3.1 enforces by leaving the cursor extension out for them.
  awareness.setLocalStateField('user', {
    userId: opts.me.userId,
    name: opts.me.name,
    color: opts.me.color,
    role: opts.role,
  });

  const onMeta = () => {
    const next = meta.get('language');
    if (typeof next === 'string') update({ language: next });
  };
  meta.observe(onMeta);

  function setRole(userId: string, role: Role): void {
    update({
      participants: snapshot.participants.map((p) => (p.userId === userId ? { ...p, role } : p)),
    });
  }

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

    setLanguage(name) {
      meta.set('language', name);
    },

    sendChat(text) {
      const trimmed = text.trim();
      if (!trimmed) return;
      const message: ChatMessage = {
        id: randomId(12),
        userId: me.userId,
        name: me.name,
        color: me.color,
        text: trimmed,
        at: Date.now(),
      };
      update({ chat: [...snapshot.chat, message] });
    },

    promote: (userId) => setRole(userId, 'editor'),
    demote: (userId) => setRole(userId, 'viewer'),

    remove(userId) {
      update({ participants: snapshot.participants.filter((p) => p.userId !== userId) });
    },

    endRoom() {
      update({ status: 'closed', closed: 'ended' });
    },

    requestLinks() {
      // Shapes the share menu without a server to mint real tokens.
      update({ links: { edit: randomId(21), view: randomId(21) } });
    },

    destroy() {
      meta.unobserve(onMeta);
      listeners.clear();
      awareness.destroy();
      doc.destroy();
    },
  };
}
