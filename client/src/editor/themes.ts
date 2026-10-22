// Editor themes. Swapped at runtime through a compartment, so changing theme never
// rebuilds the editor or loses cursor position (R38).

import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';

// Applied over both themes so the editor adopts the app's own surface colours
// instead of the theme's built-in background.
const surface = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13.5px',
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.6',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg)',
    borderRight: '1px solid var(--border)',
    color: 'var(--text-dim)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--text) 4%, transparent)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--text)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--bg-panel)',
    color: 'var(--text)',
    borderColor: 'var(--border)',
  },
});

/**
 * Overrides for the collaborative cursor layer (R29).
 *
 * y-codemirror.next hides the name label until you hover the caret, which is no
 * use when the point is knowing at a glance who is where. These make labels
 * permanently visible and give them the app's own typography instead of the
 * library's serif default.
 */
export const remoteCursorTheme = EditorView.theme({
  '.cm-ySelectionCaret': {
    position: 'relative',
  },
  '.cm-ySelectionInfo': {
    opacity: '1',
    transitionDelay: '0s',
    top: '-1.35em',
    left: '-1px',
    padding: '1px 4px',
    borderRadius: '3px 3px 3px 0',
    fontFamily: 'var(--font-ui)',
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '0.01em',
    color: '#fff',
    // Labels sit over the line above; never let them swallow clicks.
    pointerEvents: 'none',
  },
  '.cm-ySelectionCaret:hover > .cm-ySelectionInfo': {
    opacity: '1',
  },
});

export function editorTheme(dark: boolean): Extension {
  // oneDark bundles its own highlight style; `surface` follows to win on background.
  return dark
    ? [oneDark, surface]
    : [syntaxHighlighting(defaultHighlightStyle, { fallback: true }), surface];
}
