// Who the browser says you are. Self-asserted by design: there are no accounts.
// The server uses this for display and for role overrides, never as proof — see the
// security posture section of REQUIREMENTS.md.

import { colorFor } from '@shared/types';
import { createStore, readLocal, writeLocal } from './store';

const KEY_USER = 'livecode.userId';
const KEY_NAME = 'livecode.name';

export const MAX_NAME_LENGTH = 32;

export interface Identity {
  userId: string;
  /** null until the person has chosen one (R25) */
  name: string | null;
  color: string;
}

function newUserId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function load(): Identity {
  let userId = readLocal(KEY_USER);
  if (!userId) {
    userId = newUserId();
    writeLocal(KEY_USER, userId);
  }
  const stored = readLocal(KEY_NAME);
  return { userId, name: stored?.trim() || null, color: colorFor(userId) };
}

export const identity = createStore<Identity>(load());

/** Remembered for next time (R26). */
export function setName(name: string): void {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!trimmed) return;
  writeLocal(KEY_NAME, trimmed);
  identity.set({ ...identity.get(), name: trimmed });
}

const ADJECTIVES = ['Quick', 'Quiet', 'Curious', 'Clever', 'Brave', 'Calm', 'Keen', 'Bright'];
const ANIMALS = ['Otter', 'Heron', 'Fox', 'Ibex', 'Lynx', 'Magpie', 'Tern', 'Wren'];

/** Prefill for the prompt, so nobody has to invent something to get started. */
export function suggestName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adjective} ${animal}`;
}
