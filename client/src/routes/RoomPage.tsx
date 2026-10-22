import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { canWrite, type Role } from '@shared/types';
import { Header } from '../components/Header';
import { LanguagePicker } from '../components/LanguagePicker';
import { CodeEditor } from '../editor/CodeEditor';
import { DEFAULT_LANGUAGE } from '../editor/languages';
import { useStore } from '../lib/store';
import { theme } from '../lib/theme';
import { Expired } from './Expired';

interface Props {
  /** What the link claims. The server decides the real role (R17). */
  claimedRole: Role;
}

export function RoomPage({ claimedRole }: Props) {
  const { roomId } = useParams<{ roomId: string }>();
  const currentTheme = useStore(theme);
  // Local for now. T3.6 makes it a shared room setting (R13).
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);

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
        <aside className="side-panel">
          <div className="panel-section">
            <div className="panel-title">In this room</div>
            <div className="placeholder">Participants go here (T3.2).</div>
          </div>
          <div className="panel-section">
            <div className="panel-title">Chat</div>
            <div className="placeholder">Chat goes here (T4.2).</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
