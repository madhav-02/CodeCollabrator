// Participant list helpers. Separate from the join path so the control channel can
// use them without importing it.

import type { Participant } from '@shared/types';
import type { Room } from './rooms';
import { sendControl } from './wire';

const MAX_NAME = 32;

/**
 * Names are supplied by the client and shown to everyone else, so control
 * characters are stripped — otherwise a name could break the roster layout or
 * inject newlines into chat.
 */
export function cleanName(raw: string | null): string {
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
