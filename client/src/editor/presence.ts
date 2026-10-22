// Kept free of CodeMirror imports so it can be exercised outside a browser.

import type { Awareness } from 'y-protocols/awareness';

/**
 * Renders other people's cursors while never publishing our own (R30).
 *
 * y-codemirror.next announces the local cursor through
 * `awareness.setLocalStateField('cursor', …)`, so intercepting that single field is
 * enough. Passing `null` awareness to yCollab instead would also stop remote
 * cursors being drawn, and clearing the field after the fact would double the
 * presence traffic on every selection change — with thirty observers in a
 * classroom that adds up.
 */
export function withoutLocalCursor(awareness: Awareness): Awareness {
  return new Proxy(awareness, {
    get(target, prop) {
      if (prop === 'setLocalStateField') {
        return (field: string, value: unknown) => {
          if (field === 'cursor') return;
          target.setLocalStateField(field, value);
        };
      }
      const value = Reflect.get(target, prop);
      // Methods must keep their original receiver, since Awareness reads its own
      // internal state.
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
