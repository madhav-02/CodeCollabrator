import type { IncomingMessage } from 'node:http';
import type { RawData, WebSocket } from 'ws';
import { LIMITS, colorFor, type CloseReason } from '@shared/types';
import { handleControlMessage } from './control';
import { closeRoom, getRoom, resolveRole, type Connection } from './rooms';
import { broadcastRoster, cleanName } from './roster';
import { clearPresence, handleBinary, sendInitialSync } from './sync';
import { sendControl, toBytes, toText } from './wire';

/** The client generates a UUID; anything outside this is not from our client. */
const SAFE_USER_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Say why before closing, so the client can show the right page rather than a
 * generic failure (R7).
 */
function refuse(socket: WebSocket, reason: CloseReason): void {
  sendControl(socket, { t: 'closed', reason });
  socket.close(1008, reason);
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
    chatTimes: [],
  };

  room.connections.add(conn);
  // Someone is here again, so the idle clock stops (R6).
  room.emptySince = null;

  console.log(`[livecode] room ${room.id}: ${conn.name} joined as ${role}`);

  sendControl(socket, { t: 'role', role });
  broadcastRoster(room);
  // Someone arriving at minute 40 should see what was said earlier (R34).
  if (room.chat.length > 0) {
    sendControl(socket, { t: 'chatHistory', messages: room.chat });
  }
  sendInitialSync(conn, room);

  socket.on('message', (data: RawData, isBinary: boolean) => {
    if (isBinary) {
      // Role is checked inside, per message kind (R18).
      handleBinary(conn, room, toBytes(data));
      return;
    }
    handleControlMessage(conn, room, toText(data));
  });

  socket.on('close', () => {
    // The room may already be gone — the host could have ended it, which closes
    // every socket including this one.
    if (getRoom(room.id) !== room) return;

    clearPresence(conn, room);
    room.connections.delete(conn);
    console.log(`[livecode] room ${room.id}: ${conn.name} left`);

    // When the host leaves, the room goes with them (R23). Two tabs count as two
    // connections, so closing one of them must not end the session.
    if (conn.role === 'host' && ![...room.connections].some((c) => c.role === 'host')) {
      closeRoom(room, 'hostLeft');
      return;
    }

    if (room.connections.size === 0) {
      // Start the idle countdown; the sweep itself is T5.1.
      room.emptySince = Date.now();
    } else {
      broadcastRoster(room);
    }
  });
}
