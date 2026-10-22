import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { canWrite } from '@shared/types';
import type { Role } from '@shared/types';
import { Chat } from '../components/Chat';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { Header } from '../components/Header';
import { LanguagePicker } from '../components/LanguagePicker';
import { Roster } from '../components/Roster';
import { ShareMenu } from '../components/ShareMenu';
import { Sheet } from '../components/Sheet';
import { CodeEditor } from '../editor/CodeEditor';
import { collabExtensions } from '../editor/collab';
import { DEFAULT_LANGUAGE } from '../editor/languages';
import { readHostToken } from '../lib/roomLink';
import { useStore } from '../lib/store';
import { theme } from '../lib/theme';
import { NARROW, useMediaQuery } from '../lib/useMediaQuery';
import { RoomProvider, useRoom, useTransport } from '../room/RoomContext';
import { Expired } from './Expired';

interface Props {
  /** What the link claims. The server decides the real role (R17). */
  claimedRole: Role;
}

type PanelName = 'people' | 'chat';

const PANEL_TITLE: Record<PanelName, string> = {
  people: 'In this room',
  chat: 'Chat',
};

export function RoomPage({ claimedRole }: Props) {
  const { roomId, token: urlToken } = useParams<{ roomId: string; token: string }>();

  // The host's token comes out of the URL fragment; the other two are in the path.
  // Read once, because reading it also strips it from the address bar.
  const [token] = useState(() =>
    claimedRole === 'host' ? (readHostToken(roomId ?? '') ?? '') : (urlToken ?? ''),
  );

  if (!roomId) return <Expired reason="notFound" />;

  return (
    <RoomProvider
      roomId={roomId}
      claimedRole={claimedRole}
      token={token}
      defaultLanguage={DEFAULT_LANGUAGE}
      fallback={<Shell roomId={roomId} message="Joining the room…" />}
    >
      <RoomView roomId={roomId} />
    </RoomProvider>
  );
}

function Shell({ roomId, message }: { roomId: string; message: string }) {
  return (
    <div className="app">
      <Header roomId={roomId} />
      <div className="centre">
        <p className="muted">{message}</p>
      </div>
    </div>
  );
}

function PanelBody({ name }: { name: PanelName }) {
  return name === 'people' ? <Roster /> : <Chat />;
}

function RoomView({ roomId }: { roomId: string }) {
  const transport = useTransport();
  const { role, language, closed, status, chat } = useRoom();
  const currentTheme = useStore(theme);
  const narrow = useMediaQuery(NARROW);
  const [openPanel, setOpenPanel] = useState<PanelName | null>(null);
  const [seenChat, setSeenChat] = useState(0);

  // On a wide screen the transcript is always on display, so nothing is unread.
  const chatVisible = !narrow || openPanel === 'chat';
  useEffect(() => {
    if (chatVisible) setSeenChat(chat.length);
  }, [chatVisible, chat.length]);
  const unread = Math.max(0, chat.length - seenChat);
  // Rebuilt if the role changes, since that decides whether we publish a cursor.
  const collab = useMemo(() => collabExtensions(transport, role), [transport, role]);

  // The room is gone; say why rather than showing an empty editor (R7).
  if (closed) return <Expired reason={closed} />;

  const mayWrite = canWrite(role);

  return (
    <div className="app">
      <Header roomId={roomId}>
        <ConnectionStatus status={status} />
        <ShareMenu roomId={roomId} />
        <LanguagePicker
          value={language}
          onChange={transport.setLanguage}
          disabled={!mayWrite}
        />
      </Header>

      <div className="room-body">
        <div className="editor-pane">
          <CodeEditor
            // The editor reads its extensions once, so a role change has to
            // remount it. Costs the local undo history, which is acceptable for
            // something as rare as being promoted or demoted.
            key={role}
            language={language}
            dark={currentTheme === 'dark'}
            readOnly={!mayWrite}
            extensions={collab}
            // Yjs owns undo now, so CodeMirror's own history must go (R14).
            localHistory={false}
          />
        </div>

        {!narrow && (
          <aside className="side-panel">
            <section className="panel-section">
              <div className="panel-title">{PANEL_TITLE.people}</div>
              <PanelBody name="people" />
            </section>
            <section className="panel-section panel-grow">
              <div className="panel-title">{PANEL_TITLE.chat}</div>
              <PanelBody name="chat" />
            </section>
          </aside>
        )}
      </div>

      {/* On a phone the panels live behind a bottom bar instead of vanishing. */}
      {narrow && (
        <nav className="mobile-bar">
          <button className="btn" onClick={() => setOpenPanel('people')}>
            People
          </button>
          <button className="btn" onClick={() => setOpenPanel('chat')}>
            Chat
            {unread > 0 && (
              <>
                <span className="unread-dot" aria-hidden="true" />
                <span className="sr-only">{unread} unread messages</span>
              </>
            )}
          </button>
        </nav>
      )}

      {narrow && openPanel && (
        <Sheet title={PANEL_TITLE[openPanel]} onClose={() => setOpenPanel(null)}>
          <PanelBody name={openPanel} />
        </Sheet>
      )}
    </div>
  );
}
