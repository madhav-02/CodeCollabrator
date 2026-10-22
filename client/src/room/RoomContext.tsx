import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { Role } from '@shared/types';
import { identity } from '../lib/identity';
import { useStore } from '../lib/store';
import { createOfflineTransport } from './offlineTransport';
import type { RoomSnapshot, RoomTransport } from './transport';

const Ctx = createContext<RoomTransport | null>(null);

interface Props {
  roomId: string;
  claimedRole: Role;
  defaultLanguage: string;
  /** Shown until the transport exists, including while the name is still unset. */
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoomProvider({
  roomId,
  claimedRole,
  defaultLanguage,
  fallback = null,
  children,
}: Props) {
  const { userId, name, color } = useStore(identity);

  // Built inside an effect so React's StrictMode double-mount cannot leave an
  // orphaned instance behind. That matters far more in T2.4, where this owns a
  // live socket rather than a local document.
  const [transport, setTransport] = useState<RoomTransport | null>(null);

  useEffect(() => {
    // Nobody joins anonymously; the name prompt is covering the screen (R25).
    if (!name) return;

    const created = createOfflineTransport({
      roomId,
      role: claimedRole,
      me: { userId, name, color },
      defaultLanguage,
    });
    setTransport(created);

    return () => {
      created.destroy();
      setTransport(null);
    };
    // Renaming currently rebuilds the transport. Once the roster can edit a name
    // (T3.2) this should send a rename message instead of reconnecting.
  }, [roomId, claimedRole, defaultLanguage, userId, name, color]);

  if (!transport) return <>{fallback}</>;

  return <Ctx.Provider value={transport}>{children}</Ctx.Provider>;
}

export function useTransport(): RoomTransport {
  const transport = useContext(Ctx);
  if (!transport) throw new Error('useTransport used outside RoomProvider');
  return transport;
}

export function useRoom(): RoomSnapshot {
  const transport = useTransport();
  return useSyncExternalStore(
    transport.subscribe,
    transport.getSnapshot,
    transport.getSnapshot,
  );
}
