// The text side of the socket: everything that is not a document change.
//
// Each message is treated as untrusted input. The shape is checked before use, and
// anything host-only is checked against the role the server resolved, never against
// what the client claims (R17).

import { LIMITS, type ChatMessage, type ClientControl, type Role } from '@shared/types';
import { closeRoom, type Connection, type Room } from './rooms';
import { broadcastRoster, cleanName } from './roster';
import { randomToken } from './tokens';
import { sendControl } from './wire';

function parse(raw: string): ClientControl | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    if (typeof (value as { t?: unknown }).t !== 'string') return null;
    return value as ClientControl;
  } catch {
    return null;
  }
}

function requireHost(conn: Connection): boolean {
  if (conn.role === 'host') return true;
  sendControl(conn.socket, { t: 'rejected', message: 'Only the host can do that.' });
  return false;
}

/**
 * Role changes are keyed by the browser's self-asserted id, which is what lets a
 * demotion survive a reload (R20, R24). It is also why a determined person can
 * shed one by clearing their storage — stated plainly in REQUIREMENTS.md.
 */
function assignRole(room: Room, userId: string, role: Role): void {
  room.overrides.set(userId, role);

  for (const conn of room.connections) {
    if (conn.userId !== userId) continue;
    conn.role = role;
    sendControl(conn.socket, { t: 'role', role });
  }

  broadcastRoster(room);
}

function removeParticipant(room: Room, userId: string): void {
  // Barred for the room's remaining life, not just disconnected (R21).
  room.removed.add(userId);
  room.overrides.delete(userId);

  for (const conn of [...room.connections]) {
    if (conn.userId !== userId) continue;
    sendControl(conn.socket, { t: 'closed', reason: 'removed' });
    conn.socket.close(1008, 'removed');
  }
  // The close handler takes them out of the room and re-broadcasts the roster.
}

const CHAT_WINDOW_MS = 5_000;
const CHAT_PER_WINDOW = 5;

/**
 * Chat travels on this channel rather than inside the document, because the
 * document rejects writes from viewers and viewers are allowed to chat (R33).
 *
 * A useful side effect: the server stamps the sender from the connection, so a
 * message cannot be posted under somebody else's name.
 */
function postChat(conn: Connection, room: Room, rawText: string): void {
  const text = rawText.replace(/\p{Cc}/gu, ' ').trim().slice(0, LIMITS.maxChatLength);
  if (!text) return;

  const now = Date.now();
  conn.chatTimes = conn.chatTimes.filter((at) => now - at < CHAT_WINDOW_MS);
  if (conn.chatTimes.length >= CHAT_PER_WINDOW) {
    sendControl(conn.socket, { t: 'rejected', message: 'Slow down a moment.' });
    return;
  }
  conn.chatTimes.push(now);

  const chatMessage: ChatMessage = {
    id: randomToken(12),
    userId: conn.userId,
    name: conn.name,
    color: conn.color,
    text,
    at: now,
  };

  room.chat.push(chatMessage);
  // Bounded, because a room can live an hour and this is all in memory (N2, N7).
  if (room.chat.length > LIMITS.chatHistory) {
    room.chat.splice(0, room.chat.length - LIMITS.chatHistory);
  }

  for (const peer of room.connections) {
    sendControl(peer.socket, { t: 'chat', message: chatMessage });
  }
}

export function handleControlMessage(conn: Connection, room: Room, raw: string): void {
  const message = parse(raw);
  if (!message) return;

  switch (message.t) {
    case 'rename': {
      if (typeof message.name !== 'string') return;
      const next = cleanName(message.name);
      if (next === conn.name) return;
      conn.name = next;
      broadcastRoster(room);
      return;
    }

    case 'promote':
    case 'demote': {
      if (typeof message.userId !== 'string') return;
      if (!requireHost(conn)) return;
      // The host holds the host token, so changing their own role would achieve
      // nothing except confusion.
      if (message.userId === conn.userId) return;
      assignRole(room, message.userId, message.t === 'promote' ? 'editor' : 'viewer');
      console.log(`[livecode] room ${room.id}: ${conn.name} ${message.t}d ${message.userId}`);
      return;
    }

    case 'remove': {
      if (typeof message.userId !== 'string') return;
      if (!requireHost(conn)) return;
      if (message.userId === conn.userId) return;
      removeParticipant(room, message.userId);
      console.log(`[livecode] room ${room.id}: ${conn.name} removed ${message.userId}`);
      return;
    }

    case 'end': {
      if (!requireHost(conn)) return;
      console.log(`[livecode] room ${room.id}: ended by ${conn.name}`);
      closeRoom(room, 'ended');
      return;
    }

    case 'chat': {
      if (typeof message.text !== 'string') return;
      postChat(conn, room, message.text);
      return;
    }

    case 'links': {
      // Only the host may see the other two links (R19). They are never logged.
      if (!requireHost(conn)) return;
      sendControl(conn.socket, {
        t: 'links',
        edit: room.tokens.edit,
        view: room.tokens.view,
      });
      return;
    }

    // Chat is T4.1.
    default:
      return;
  }
}
