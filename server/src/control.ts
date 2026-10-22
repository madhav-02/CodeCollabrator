// The text side of the socket: everything that is not a document change.
//
// Each message is treated as untrusted input. The shape is checked before use, and
// anything host-only is checked against the role the server resolved, never against
// what the client claims (R17).

import type { ClientControl } from '@shared/types';
import type { Connection, Room } from './rooms';
import { broadcastRoster, cleanName } from './roster';

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

    // Host actions arrive in T3.3, chat in T4.1.
    default:
      return;
  }
}
