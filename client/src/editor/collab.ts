// Binds CodeMirror to the room's Yjs document.

import { yCollab } from 'y-codemirror.next';
import type { Extension } from '@codemirror/state';
import { DOC } from '@shared/types';
import type { RoomTransport } from '../room/transport';

interface Options {
  /**
   * Whether to render other people's cursors and publish our own. T3.1 turns this
   * off for viewers, so a room of observers does not flood the gutter (R30).
   */
  cursors?: boolean;
}

export function collabExtensions(
  transport: RoomTransport,
  { cursors = true }: Options = {},
): Extension[] {
  const text = transport.doc.getText(DOC.content);

  // yCollab builds its own Y.UndoManager over this text, which tracks only this
  // client's own changes. That is what makes undo per-person (R14), and it is why
  // CodeMirror's native history must be switched off alongside it.
  return [yCollab(text, cursors ? transport.awareness : null)];
}
