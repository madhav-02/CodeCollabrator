import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { COLORS, type Role } from '@shared/types';
import { randomId } from '../lib/ids';
import { createOfflineTransport } from './offlineTransport';
import type { Me, RoomSnapshot, RoomTransport } from './transport';

const Ctx = createContext<RoomTransport | null>(null);

interface Props {
  roomId: string;
  claimedRole: Role;
  defaultLanguage: string;
  /** Shown for the frame before the transport exists. */
  fallback?: ReactNode;
  children: ReactNode;
}

/** Stand-in until T1.6 asks for a username and stores a stable id. */
function provisionalMe(): Me {
  return { userId: randomId(12), name: 'You', color: COLORS[0] };
}

export function RoomProvider({
  roomId,
  claimedRole,
  defaultLanguage,
  fallback = null,
  children,
}: Props) {
  // Built inside an effect so React's StrictMode double-mount cannot leave an
  // orphaned instance behind. That matters far more in T2.4, where this owns a
  // live socket rather than a local document.
  const [transport, setTransport] = useState<RoomTransport | null>(null);

  useEffect(() => {
    const created = createOfflineTransport({
      roomId,
      role: claimedRole,
      me: provisionalMe(),
      defaultLanguage,
    });
    setTransport(created);

    return () => {
      created.destroy();
      setTransport(null);
    };
  }, [roomId, claimedRole, defaultLanguage]);

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
