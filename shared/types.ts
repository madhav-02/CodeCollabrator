// Shared between client and server. Keep free of runtime dependencies.

export type Role = 'host' | 'editor' | 'viewer';

/** Can this role change the document or the language? (R18, B2) */
export function canWrite(role: Role): boolean {
  return role === 'host' || role === 'editor';
}

export interface Participant {
  userId: string;
  name: string;
  color: string;
  role: Role;
}

export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  color: string;
  text: string;
  at: number;
}

export type CloseReason =
  | 'ended' // host ended it deliberately
  | 'hostLeft' // host disconnected (R23)
  | 'removed' // this participant was removed (R21)
  | 'expired' // room no longer exists (R7)
  | 'notFound'
  | 'badToken'
  | 'full'; // participant cap reached (R8)

export const CLOSE_TEXT: Record<CloseReason, string> = {
  ended: 'The host ended this room.',
  hostLeft: 'The host left, so the room closed.',
  removed: 'You were removed from this room.',
  expired: 'This room has expired.',
  notFound: 'That room does not exist.',
  badToken: 'That link is not valid.',
  full: 'This room is full.',
};

/** Browser to server. */
export type ClientControl =
  | { t: 'promote'; userId: string }
  | { t: 'demote'; userId: string }
  | { t: 'remove'; userId: string }
  | { t: 'end' }
  | { t: 'links' }
  | { t: 'chat'; text: string }
  | { t: 'rename'; name: string };

/** Server to browser. */
export type ServerControl =
  | { t: 'role'; role: Role }
  | { t: 'roster'; users: Participant[] }
  | { t: 'links'; edit: string; view: string }
  | { t: 'chatHistory'; messages: ChatMessage[] }
  | { t: 'chat'; message: ChatMessage }
  | { t: 'closed'; reason: CloseReason }
  | { t: 'rejected'; message: string };

export interface CreateRoomResponse {
  roomId: string;
  hostToken: string;
  editToken: string;
  viewToken: string;
}

export const LIMITS = {
  /** R8 */
  maxParticipants: 25,
  /** R16 */
  maxDocBytes: 1_000_000,
  /** N7 */
  maxFrameBytes: 192 * 1024,
  maxChatLength: 2000,
  chatHistory: 500,
  messagesPerSecond: 60,
  maxRooms: 500,
  roomsPerAddressPerHour: 30,
  /** R5 */
  idleRoomMs: 60 * 60 * 1000,
} as const;

/** Cursor colors, picked to stay legible on both themes (R28). */
export const COLORS = [
  '#1f6feb',
  '#bc4c00',
  '#8250df',
  '#0f766e',
  '#b91c5c',
  '#a16207',
  '#1d4ed8',
  '#15803d',
  '#9333ea',
  '#c2410c',
] as const;
