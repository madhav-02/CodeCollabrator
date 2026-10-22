// The single interface the UI uses to reach a room.
//
// Phase 1 ships an offline implementation so the whole room screen can be built and
// used with no server. Phase 2 (T2.4) swaps in a WebSocket implementation behind this
// same shape, with no UI changes. It is also the seam that would contain a later move
// off Node, so nothing above this line should know how messages travel.

import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import type { ChatMessage, CloseReason, Participant, Role } from '@shared/types';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface RoomSnapshot {
  /** Decided by the server in Phase 2; never trust the link alone (R17). */
  role: Role;
  status: ConnectionStatus;
  participants: Participant[];
  chat: ChatMessage[];
  /** The room's shared language setting (R13). */
  language: string;
  /** Host only, and only once requested (R19). */
  links: { edit: string; view: string } | null;
  /** Set once the room has gone for good; the UI shows why (R7). */
  closed: CloseReason | null;
}

export interface Me {
  userId: string;
  name: string;
  color: string;
}

export interface TransportOptions {
  roomId: string;
  me: Me;
  /** What the link claimed. A starting point, not an authority. */
  role: Role;
  defaultLanguage: string;
}

export interface RoomTransport {
  /** The shared document. The code itself is the `content` text. */
  readonly doc: Y.Doc;
  /** Presence: cursors, names, colours (R29). */
  readonly awareness: Awareness;

  /** Identity-stable between changes, so useSyncExternalStore does not spin. */
  getSnapshot(): RoomSnapshot;
  subscribe(listener: () => void): () => void;

  setLanguage(name: string): void;
  /** Everyone may chat, viewers included (R33). */
  sendChat(text: string): void;

  // Host-only. The server ignores these from anyone else (R17).
  promote(userId: string): void;
  demote(userId: string): void;
  remove(userId: string): void;
  endRoom(): void;
  requestLinks(): void;

  destroy(): void;
}
