import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  roomId?: string;
  /** Filled by later tasks: language picker, share menu, theme toggle. */
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
    </header>
  );
}
