import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { canWrite, type Role } from '@shared/types';
import { Header } from '../components/Header';
import { LanguagePicker } from '../components/LanguagePicker';
import { Sheet } from '../components/Sheet';
import { CodeEditor } from '../editor/CodeEditor';
import { DEFAULT_LANGUAGE } from '../editor/languages';
import { useStore } from '../lib/store';
import { theme } from '../lib/theme';
import { NARROW, useMediaQuery } from '../lib/useMediaQuery';
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

function PanelBody({ name }: { name: PanelName }) {
  return name === 'people' ? (
    <div className="placeholder">Participants go here (T3.2).</div>
  ) : (
    <div className="placeholder">Chat goes here (T4.2).</div>
  );
}

export function RoomPage({ claimedRole }: Props) {
  const { roomId } = useParams<{ roomId: string }>();
  const currentTheme = useStore(theme);
  const narrow = useMediaQuery(NARROW);
  // Local for now. T3.6 makes it a shared room setting (R13).
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [openPanel, setOpenPanel] = useState<PanelName | null>(null);

  if (!roomId) return <Expired reason="notFound" />;

  const mayWrite = canWrite(claimedRole);

  return (
    <div className="app">
      <Header roomId={roomId}>
        <LanguagePicker value={language} onChange={setLanguage} disabled={!mayWrite} />
      </Header>

      <div className="room-body">
        <div className="editor-pane">
          <CodeEditor
            language={language}
            dark={currentTheme === 'dark'}
            readOnly={!mayWrite}
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
