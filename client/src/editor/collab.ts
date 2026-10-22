// Binds CodeMirror to the room's Yjs document, including other people's cursors.

import { yCollab } from 'y-codemirror.next';
import type { Extension } from '@codemirror/state';
import { DOC, canWrite, type Role } from '@shared/types';
import type { RoomTransport } from '../room/transport';
import { withoutLocalCursor } from './presence';
import { remoteCursorTheme } from './themes';

export function collabExtensions(transport: RoomTransport, role: Role): Extension[] {
  const text = transport.doc.getText(DOC.content);
  const awareness = canWrite(role)
    ? transport.awareness
    : withoutLocalCursor(transport.awareness);

  // yCollab builds its own Y.UndoManager over this text, which tracks only this
  // client's own changes. That is what makes undo per-person (R14), and it is why
  // CodeMirror's native history must be switched off alongside it.
  //
  // The cursor theme follows yCollab deliberately: both are CodeMirror themes of
  // equal specificity, so the later one wins.
  return [yCollab(text, awareness), remoteCursorTheme];
}
