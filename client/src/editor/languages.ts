// Language list for highlighting (R12). Grammars load on demand, so offering 40+
// languages costs nothing until one is chosen.

import { languages } from '@codemirror/language-data';
import type { LanguageDescription } from '@codemirror/language';

/** Shown first. Anything missing upstream is skipped rather than breaking the list. */
const PINNED = [
  'TypeScript',
  'JavaScript',
  'Python',
  'Java',
  'C++',
  'C#',
  'Go',
  'Rust',
  'SQL',
  'HTML',
  'CSS',
  'JSON',
  'Markdown',
  'Shell',
];

const byName = new Map(languages.map((l) => [l.name, l]));

export const languageOptions: LanguageDescription[] = (() => {
  const pinned = PINNED.map((n) => byName.get(n)).filter((l): l is LanguageDescription => !!l);
  const pinnedNames = new Set(pinned.map((l) => l.name));
  const rest = languages
    .filter((l) => !pinnedNames.has(l.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...pinned, ...rest];
})();

export const DEFAULT_LANGUAGE = byName.has('TypeScript')
  ? 'TypeScript'
  : languageOptions[0].name;

export function findLanguage(name: string): LanguageDescription | undefined {
  return byName.get(name);
}
