import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  roomId?: string;
  /** Page-specific controls: language picker (T1.4), share menu (T3.7). */
  children?: ReactNode;
}

export function Header({ roomId, children }: Props) {
  return (
    <header className="header">
      <Link to="/" className="header-brand">
        LiveCode
      </Link>
      {roomId && <span className="header-room mono">room {roomId}</span>}
      <span className="header-spacer" />
      {children}
      <ThemeToggle />
    </header>
  );
}
