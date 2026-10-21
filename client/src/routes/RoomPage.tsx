import { useParams } from 'react-router-dom';
import type { Role } from '@shared/types';
import { Header } from '../components/Header';
import { Expired } from './Expired';

interface Props {
  /** What the link claims. The server decides the real role (R17). */
  claimedRole: Role;
}

export function RoomPage({ claimedRole }: Props) {
  const { roomId } = useParams<{ roomId: string }>();

  if (!roomId) return <Expired reason="notFound" />;

  return (
    <div className="app">
      <Header roomId={roomId} />
      <div className="room-body">
        <div className="editor-pane">
          <div className="placeholder">
            Editor goes here (T1.2). This link claims the <strong>{claimedRole}</strong> role;
            the server will decide the real one.
          </div>
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
