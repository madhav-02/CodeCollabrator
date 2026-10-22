// Base editor configuration. Language, theme and read-only live in compartments so
// each can be reconfigured at runtime without recreating the editor.

import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput } from '@codemirror/language';
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';

export const languageConf = new Compartment();
export const themeConf = new Compartment();
export const readOnlyConf = new Compartment();

interface BaseOptions {
  /**
   * CodeMirror's own undo stack. Switched off once Yjs is driving the document
   * (T1.8), because Yjs supplies per-user undo instead (R14).
   */
  localHistory: boolean;
}

export function baseExtensions({ localHistory }: BaseOptions): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    EditorView.lineWrapping,
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...completionKeymap,
      ...foldKeymap,
      // Tab indents rather than moving focus. Standard for code editors, at the
      // cost of keyboard users needing Escape then Tab to leave the editor.
      indentWithTab,
    ]),
    ...(localHistory ? [history(), keymap.of(historyKeymap)] : []),
  ];
}
