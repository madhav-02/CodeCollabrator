import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { canWrite } from '@shared/types';
import type { Role } from '@shared/types';
import { Header } from '../components/Header';
import { LanguagePicker } from '../components/LanguagePicker';
import { Sheet } from '../components/Sheet';
import { CodeEditor } from '../editor/CodeEditor';
import { collabExtensions } from '../editor/collab';
import { DEFAULT_LANGUAGE } from '../editor/languages';
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
  const { roomId } = useParams<{ roomId: string }>();

  if (!roomId) return <Expired reason="notFound" />;

  return (
    <RoomProvider
      roomId={roomId}
      claimedRole={claimedRole}
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
  const { participants, chat } = useRoom();

  return name === 'people' ? (
    <div className="placeholder">
      {participants.length} here. Participant list arrives in T3.2.
    </div>
  ) : (
    <div className="placeholder">{chat.length} messages. Chat UI arrives in T4.2.</div>
  );
}

function RoomView({ roomId }: { roomId: string }) {
  const transport = useTransport();
  const { role, language, closed } = useRoom();
  const currentTheme = useStore(theme);
  const narrow = useMediaQuery(NARROW);
  const [openPanel, setOpenPanel] = useState<PanelName | null>(null);
  // Stable for the room's lifetime; the editor reads it once, on mount.
  const collab = useMemo(() => collabExtensions(transport), [transport]);

  // The room is gone; say why rather than showing an empty editor (R7).
  if (closed) return <Expired reason={closed} />;

  const mayWrite = canWrite(role);

  return (
    <div className="app">
      <Header roomId={roomId}>
        <LanguagePicker
          value={language}
          onChange={transport.setLanguage}
          disabled={!mayWrite}
        />
      </Header>

      <div className="room-body">
        <div className="editor-pane">
          <CodeEditor
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
