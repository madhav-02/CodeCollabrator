// Light is the default (R37). The OS preference is consulted only for someone who has
// never chosen (R39).
//
// index.html carries a copy of this read, inline, so the correct theme is applied
// before first paint. Keep THEME_KEY in step with it.

import { createStore, readLocal, writeLocal } from './store';

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'livecode.theme';

function load(): Theme {
  const stored = readLocal(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(next: Theme): void {
  document.documentElement.dataset.theme = next;
}

export const theme = createStore<Theme>(load(), apply);

apply(theme.get());

export function toggleTheme(): void {
  const next: Theme = theme.get() === 'dark' ? 'light' : 'dark';
  writeLocal(THEME_KEY, next);
  theme.set(next);
}
