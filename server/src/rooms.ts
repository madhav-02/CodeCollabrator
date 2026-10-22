// In-memory room store. There is no database: rooms are deleted an hour after the
// last person leaves, so nothing outlives the process that is worth keeping (N2).

import type { WebSocket } from 'ws';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import {
  DOC,
  LIMITS,
  type ChatMessage,
  type CloseReason,
  type Participant,
  type Role,
} from '@shared/types';
import { attachRelay } from './sync';
import { newRoomId, newToken, sameToken } from './tokens';
import { sendControl } from './wire';

export interface Connection extends Participant {
  socket: WebSocket;
  roomId: string;
  /** Presence ids this connection owns, cleared when it drops. */
  awarenessIds: Set<number>;
  /** Timestamps of recent chat messages, for rate limiting (N7). */
  chatTimes: number[];
  /** Timestamps of recent frames of any kind, for the overall rate cap (N7). */
  msgTimes: number[];
  /** Limit warnings already sent, so they are not repeated every message. */
  warnings: Set<string>;
}

export interface Room {
  id: string;
  doc: Y.Doc;
  /** Cursors and names. The server holds no presence of its own. */
  awareness: Awareness;
  /** Possession of one of these is the whole authorization model. */
  tokens: { host: string; edit: string; view: string };
  /** Role changes made by the host, keyed by the browser's self-asserted id. */
  overrides: Map<string, Role>;
  /** Removed participants, barred for the room's remaining life (R21). */
  removed: Set<string>;
  /** Held here rather than in the document so viewers can chat (R33, R35). */
  chat: ChatMessage[];
  /** Live participants. The same person in two tabs counts twice (D5). */
  connections: Set<Connection>;
  createdAt: number;
  /** When the room became empty, for the idle sweep in T5.1. */
  emptySince: number | null;
}

const rooms = new Map<string, Room>();

export function roomCount(): number {
  return rooms.size;
}

export class TooManyRooms extends Error {}

export function createRoom(defaultLanguage: string): Room {
  // Rooms only leave memory via the idle sweep (T5.1), so without a ceiling this
  // endpoint is an unbounded allocation. The per-address rate limit is T5.3.
  if (rooms.size >= LIMITS.maxRooms) throw new TooManyRooms();

  const doc = new Y.Doc();
  doc.getMap(DOC.meta).set('language', defaultLanguage);

  const awareness = new Awareness(doc);
  // The server relays presence but is not itself a participant.
  awareness.setLocalState(null);

  const room: Room = {
    id: newRoomId(),
    doc,
    awareness,
    tokens: { host: newToken(), edit: newToken(), view: newToken() },
    overrides: new Map(),
    removed: new Set(),
    chat: [],
    connections: new Set(),
    createdAt: Date.now(),
    emptySince: Date.now(),
  };

  attachRelay(room);
  rooms.set(room.id, room);
  return room;
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id);
}

/**
 * Delete rooms that have been empty too long (R5). A room with anyone in it has
 * `emptySince` of null and is never touched, however long it has been open — a
 * class can run for three hours.
 */
export function sweepIdleRooms(maxIdleMs: number, now = Date.now()): string[] {
  const expired: string[] = [];

  for (const room of rooms.values()) {
    if (room.emptySince === null) continue;
    if (now - room.emptySince < maxIdleMs) continue;
    expired.push(room.id);
  }

  for (const id of expired) deleteRoom(id);
  return expired;
}

export function deleteRoom(id: string): void {
  const room = rooms.get(id);
  if (!room) return;
  room.awareness.destroy();
  room.doc.destroy();
  rooms.delete(id);
}

/**
 * Tell everyone why, disconnect them, then drop the room (R22, R23).
 *
 * Order matters: the reason has to be sent before the socket closes, or the client
 * falls back to a generic failure and tries to reconnect to a room that is gone.
 */
export function closeRoom(room: Room, reason: CloseReason): void {
  for (const conn of [...room.connections]) {
    sendControl(conn.socket, { t: 'closed', reason });
    conn.socket.close(1000, reason);
  }
  room.connections.clear();
  deleteRoom(room.id);
  console.log(`[livecode] room ${room.id} closed (${reason})`);
}

/**
 * What a token entitles this person to, or null to refuse the connection.
 *
 * Order matters: the host token always wins, so a host cannot lock themselves out.
 * After that a removal bars entry outright, then any role the host has assigned,
 * then whatever the link itself grants.
 */
export function resolveRole(room: Room, token: string, userId: string): Role | null {
  if (sameToken(token, room.tokens.host)) return 'host';
  if (room.removed.has(userId)) return null;

  const fromToken: Role | null = sameToken(token, room.tokens.edit)
    ? 'editor'
    : sameToken(token, room.tokens.view)
      ? 'viewer'
      : null;

  if (!fromToken) return null;
  return room.overrides.get(userId) ?? fromToken;
}
