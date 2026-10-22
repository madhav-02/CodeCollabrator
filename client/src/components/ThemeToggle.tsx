import { useStore } from '../lib/store';
import { theme, toggleTheme } from '../lib/theme';

export function ThemeToggle() {
  const current = useStore(theme);
  const label = current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button className="btn btn-icon" onClick={toggleTheme} aria-label={label} title={label}>
      {current === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

const ICON = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function MoonIcon() {
  return (
    <svg {...ICON}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}
