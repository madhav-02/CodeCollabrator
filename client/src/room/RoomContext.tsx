import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { Role } from '@shared/types';
import { identity } from '../lib/identity';
import { useStore } from '../lib/store';
import { createSocketTransport } from './socketTransport';
import type { RoomSnapshot, RoomTransport } from './transport';

const Ctx = createContext<RoomTransport | null>(null);

interface Props {
  roomId: string;
  claimedRole: Role;
  token: string;
  defaultLanguage: string;
  /** Shown until the transport exists, including while the name is still unset. */
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoomProvider({
  roomId,
  claimedRole,
  token,
  defaultLanguage,
  fallback = null,
  children,
}: Props) {
  const { name } = useStore(identity);
  // Only whether a name exists affects connecting, not what it is — otherwise
  // renaming would tear down the socket.
  const named = name !== null;

  // Built inside an effect so React's StrictMode double-mount cannot leave an
  // orphaned instance behind, which matters because this owns a live socket.
  const [transport, setTransport] = useState<RoomTransport | null>(null);
  const sentName = useRef<string | null>(null);

  useEffect(() => {
    const me = identity.get();
    // Nobody joins anonymously; the name prompt is covering the screen (R25).
    if (!me.name) return;

    const created = createSocketTransport({
      roomId,
      role: claimedRole,
      token,
      me: { userId: me.userId, name: me.name, color: me.color },
      defaultLanguage,
    });
    sentName.current = me.name;
    setTransport(created);

    return () => {
      created.destroy();
      sentName.current = null;
      setTransport(null);
    };
  }, [roomId, claimedRole, token, defaultLanguage, named]);

  // A later rename is a message, not a reconnection.
  useEffect(() => {
    if (!transport || !name) return;
    if (sentName.current === name) return;
    sentName.current = name;
    transport.rename(name);
  }, [transport, name]);

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
