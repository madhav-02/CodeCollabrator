// In-memory room store. There is no database: rooms are deleted an hour after the
// last person leaves, so nothing outlives the process that is worth keeping (N2).

import * as Y from 'yjs';
import { DOC, LIMITS, type ChatMessage, type Role } from '@shared/types';
import { newRoomId, newToken, sameToken } from './tokens';

export interface Room {
  id: string;
  doc: Y.Doc;
  /** Possession of one of these is the whole authorization model. */
  tokens: { host: string; edit: string; view: string };
  /** Role changes made by the host, keyed by the browser's self-asserted id. */
  overrides: Map<string, Role>;
  /** Removed participants, barred for the room's remaining life (R21). */
  removed: Set<string>;
  /** Held here rather than in the document so viewers can chat (R33, R35). */
  chat: ChatMessage[];
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

  const room: Room = {
    id: newRoomId(),
    doc,
    tokens: { host: newToken(), edit: newToken(), view: newToken() },
    overrides: new Map(),
    removed: new Set(),
    chat: [],
    createdAt: Date.now(),
    emptySince: Date.now(),
  };

  rooms.set(room.id, room);
  return room;
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id);
}

export function deleteRoom(id: string): void {
  const room = rooms.get(id);
  if (!room) return;
  room.doc.destroy();
  rooms.delete(id);
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
