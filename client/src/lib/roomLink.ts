// Which of the three links did this person arrive on?
//
//   /r/:roomId            + #h=<token>   host
//   /r/:roomId/e/:token                  editor
//   /r/:roomId/v/:token                  viewer
//
// The host token lives in the fragment, which browsers never send to the server,
// so it cannot reach an access log or a Referer header (R19).

import type { Role } from '@shared/types';

export interface RoomLink {
  roomId: string;
  claimedRole: Role;
  token: string | null;
}

const HOST_KEY = 'livecode.host.';

export function readHostToken(roomId: string): string | null {
  const fromHash = new URLSearchParams(location.hash.replace(/^#/, '')).get('h');
  if (fromHash) {
    try {
      sessionStorage.setItem(HOST_KEY + roomId, fromHash);
    } catch {
      /* ignore */
    }
    // Drop it from the address bar so it is not copied by accident.
    history.replaceState(null, '', location.pathname + location.search);
    return fromHash;
  }
  try {
    return sessionStorage.getItem(HOST_KEY + roomId);
  } catch {
    return null;
  }
}

export function hostUrl(roomId: string, hostToken: string): string {
  return `${location.origin}/r/${roomId}#h=${hostToken}`;
}

export function editUrl(roomId: string, token: string): string {
  return `${location.origin}/r/${roomId}/e/${token}`;
}

export function viewUrl(roomId: string, token: string): string {
  return `${location.origin}/r/${roomId}/v/${token}`;
}
