// Editor themes. Swapped at runtime through a compartment, so changing theme never
// rebuilds the editor or loses cursor position (R38).

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

/**
 * Surface colours come from the app's own CSS variables rather than being baked in,
 * so the editor matches whichever theme is active without a second source of truth.
 */
const surface = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13.5px',
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
  },
  '.cm-content': {
    padding: '10px 0',
    caretColor: 'var(--accent)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.65',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-gutter)',
    borderRight: '1px solid var(--border-soft)',
    color: 'var(--text-faint)',
    paddingRight: '4px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 12px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--bg-active-line)' },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--bg-active-line)',
    color: 'var(--text-dim)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--bg-selection)',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
  '.cm-panels': {
    backgroundColor: 'var(--bg-panel)',
    color: 'var(--text)',
    border: 'none',
    borderTop: '1px solid var(--border)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'var(--bg-match)',
    outline: '1px solid var(--border)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'var(--bg-match-active)',
  },
  '.cm-selectionMatch': { backgroundColor: 'var(--bg-match)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-text)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--bg-soft)',
    border: '1px solid var(--border)',
    color: 'var(--text-dim)',
  },
});

/** Light palette: blue for calls, violet for keywords, green for strings. */
const lightSyntax = HighlightStyle.define(
  [
    { tag: [t.keyword, t.moduleKeyword, t.controlKeyword], color: '#7C3AED' },
    { tag: [t.string, t.special(t.string), t.regexp], color: '#047857' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#1D4ED8' },
    { tag: [t.typeName, t.className, t.namespace], color: '#B45309' },
    { tag: [t.number, t.bool, t.null, t.atom], color: '#B45309' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: '#7A8799', fontStyle: 'italic' },
    { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: '#5B6B7F' },
    { tag: [t.propertyName, t.attributeName], color: '#0E7490' },
    { tag: [t.variableName, t.definition(t.variableName)], color: '#16202E' },
    { tag: [t.tagName], color: '#1D4ED8' },
    { tag: [t.heading, t.strong], fontWeight: '700', color: '#16202E' },
    { tag: [t.emphasis], fontStyle: 'italic' },
    { tag: [t.link], color: '#1D4ED8', textDecoration: 'underline' },
    { tag: [t.invalid], color: '#B91C1C' },
  ],
  { themeType: 'light' },
);

/** Dark palette: same hues lifted for contrast on a dark surface. */
const darkSyntax = HighlightStyle.define(
  [
    { tag: [t.keyword, t.moduleKeyword, t.controlKeyword], color: '#C4B5FD' },
    { tag: [t.string, t.special(t.string), t.regexp], color: '#6EE7B7' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#7DD3FC' },
    { tag: [t.typeName, t.className, t.namespace], color: '#FCD34D' },
    { tag: [t.number, t.bool, t.null, t.atom], color: '#FCD34D' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: '#7A8799', fontStyle: 'italic' },
    { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: '#94A3B8' },
    { tag: [t.propertyName, t.attributeName], color: '#67E8F9' },
    { tag: [t.variableName, t.definition(t.variableName)], color: '#E8EDF5' },
    { tag: [t.tagName], color: '#7DD3FC' },
    { tag: [t.heading, t.strong], fontWeight: '700', color: '#E8EDF5' },
    { tag: [t.emphasis], fontStyle: 'italic' },
    { tag: [t.link], color: '#7DD3FC', textDecoration: 'underline' },
    { tag: [t.invalid], color: '#F87171' },
  ],
  { themeType: 'dark' },
);

export function editorTheme(dark: boolean): Extension {
  return [
    EditorView.theme({}, { dark }),
    syntaxHighlighting(dark ? darkSyntax : lightSyntax, { fallback: true }),
    surface,
  ];
}

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
    borderLeftWidth: '2px',
    marginLeft: '-1px',
  },
  '.cm-ySelectionInfo': {
    opacity: '1',
    transitionDelay: '0s',
    top: '-1.4em',
    left: '-2px',
    padding: '1px 5px',
    borderRadius: '4px 4px 4px 0',
    fontFamily: 'var(--font-ui)',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.01em',
    color: '#fff',
    // Labels sit over the line above; never let them swallow clicks.
    pointerEvents: 'none',
  },
  '.cm-ySelectionCaret:hover > .cm-ySelectionInfo': {
    opacity: '1',
  },
});
