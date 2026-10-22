import type { IncomingMessage } from 'node:http';
import { WebSocket, type RawData } from 'ws';
import {
  LIMITS,
  colorFor,
  type CloseReason,
  type Participant,
  type ServerControl,
} from '@shared/types';
import { getRoom, resolveRole, type Connection, type Room } from './rooms';
import { clearPresence, handleBinary, sendInitialSync, toBytes } from './sync';

const MAX_NAME = 32;

/** The client generates a UUID; anything outside this is not from our client. */
const SAFE_USER_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Control messages travel as text. Binary frames are Yjs (T2.4). */
export function sendControl(socket: WebSocket, message: ServerControl): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

/**
 * Say why before closing, so the client can show the right page rather than a
 * generic failure (R7).
 */
function refuse(socket: WebSocket, reason: CloseReason): void {
  sendControl(socket, { t: 'closed', reason });
  socket.close(1008, reason);
}

/**
 * Names are supplied by the client and shown to everyone else, so control
 * characters are stripped — otherwise a name could break the roster layout or
 * inject newlines into chat.
 */
function cleanName(raw: string | null): string {
  const text = (raw ?? '')
    .replace(/\p{C}/gu, '')
    .trim()
    .slice(0, MAX_NAME);
  return text || 'Anonymous';
}

export function participantsOf(room: Room): Participant[] {
  return [...room.connections].map(({ userId, name, color, role }) => ({
    userId,
    name,
    color,
    role,
  }));
}

export function broadcastRoster(room: Room): void {
  const users = participantsOf(room);
  for (const conn of room.connections) {
    sendControl(conn.socket, { t: 'roster', users });
  }
}

export function handleJoin(socket: WebSocket, req: IncomingMessage): void {
  const url = new URL(req.url ?? '/', 'http://local');
  const roomId = url.searchParams.get('room') ?? '';
  const token = url.searchParams.get('token') ?? '';
  const userId = url.searchParams.get('user') ?? '';

  if (!SAFE_USER_ID.test(userId)) {
    refuse(socket, 'badToken');
    return;
  }

  const room = getRoom(roomId);
  if (!room) {
    // Covers both a wrong id and a room the idle sweep has already removed.
    refuse(socket, 'notFound');
    return;
  }

  const role = resolveRole(room, token, userId);
  if (!role) {
    refuse(socket, room.removed.has(userId) ? 'removed' : 'badToken');
    return;
  }

  if (room.connections.size >= LIMITS.maxParticipants) {
    refuse(socket, 'full');
    return;
  }

  const conn: Connection = {
    socket,
    roomId: room.id,
    userId,
    name: cleanName(url.searchParams.get('name')),
    color: colorFor(userId),
    role,
    awarenessIds: new Set(),
  };

  room.connections.add(conn);
  // Someone is here again, so the idle clock stops (R6).
  room.emptySince = null;

  console.log(`[livecode] room ${room.id}: ${conn.name} joined as ${role}`);

  sendControl(socket, { t: 'role', role });
  broadcastRoster(room);
  sendInitialSync(conn, room);

  socket.on('message', (data: RawData, isBinary: boolean) => {
    if (isBinary) {
      // T2.5 adds the viewer check here. Until then any role can write.
      handleBinary(conn, room, toBytes(data));
      return;
    }
    // Client control messages (chat, host actions) arrive in T3.3 and T4.1.
  });

  socket.on('close', () => {
    clearPresence(conn, room);
    room.connections.delete(conn);
    if (room.connections.size === 0) {
      // Start the idle countdown; the sweep itself is T5.1.
      room.emptySince = Date.now();
    } else {
      broadcastRoster(room);
    }
    console.log(`[livecode] room ${room.id}: ${conn.name} left`);
  });
}
