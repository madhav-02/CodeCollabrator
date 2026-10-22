import { useEffect, useRef } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { baseExtensions, languageConf, readOnlyConf, themeConf } from './setup';
import { editorTheme } from './themes';
import { findLanguage } from './languages';

interface Props {
  /** A name from `languageOptions`. Omit for plain text. */
  language?: string;
  dark?: boolean;
  /** UI affordance only. Real enforcement is server-side (R18). */
  readOnly?: boolean;
  initialDoc?: string;
  /** Extra extensions, e.g. the Yjs binding (T1.8). Read once, on mount. */
  extensions?: Extension[];
  localHistory?: boolean;
}

export function CodeEditor({
  language,
  dark = false,
  readOnly = false,
  initialDoc = '',
  extensions,
  localHistory = true,
}: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);

  // The document belongs to CodeMirror, not to React, so these are read once.
  const mount = useRef({ initialDoc, extensions, localHistory, dark, readOnly });

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const o = mount.current;

    const instance = new EditorView({
      state: EditorState.create({
        doc: o.initialDoc,
        extensions: [
          ...baseExtensions({ localHistory: o.localHistory }),
          languageConf.of([]),
          themeConf.of(editorTheme(o.dark)),
          readOnlyConf.of(EditorState.readOnly.of(o.readOnly)),
          ...(o.extensions ?? []),
        ],
      }),
      parent,
    });
    view.current = instance;

    return () => {
      instance.destroy();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    view.current?.dispatch({ effects: themeConf.reconfigure(editorTheme(dark)) });
  }, [dark]);

  useEffect(() => {
    view.current?.dispatch({
      effects: readOnlyConf.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  useEffect(() => {
    let cancelled = false;

    if (!language) {
      view.current?.dispatch({ effects: languageConf.reconfigure([]) });
    } else {
      const desc = findLanguage(language);
      desc
        ?.load()
        .then((support) => {
          if (!cancelled) {
            view.current?.dispatch({ effects: languageConf.reconfigure(support) });
          }
        })
        .catch(() => {
          // A grammar that fails to load leaves plain text, which is survivable.
        });
    }

    return () => {
      cancelled = true;
    };
  }, [language]);

  return <div className="editor-host" ref={host} />;
}
