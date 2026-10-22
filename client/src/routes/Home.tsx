import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CreateRoomResponse } from '@shared/types';
import { Header } from '../components/Header';

export function Home() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/rooms', { method: 'POST' });
      if (!res.ok) throw new Error(`server returned ${res.status}`);

      const room = (await res.json()) as CreateRoomResponse;
      // The host token goes in the fragment, which browsers never send to a
      // server, so it stays out of logs and Referer headers (R19).
      navigate(`/r/${room.roomId}#h=${room.hostToken}`);
    } catch {
      setError('Could not create a room. Is the server running?');
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <Header />
      <div className="centre">
        <div className="card">
          <h1>Share a code editor</h1>
          <p>
            Create a room, send the link, and write code together. Nothing is executed and
            nothing is kept — a room disappears an hour after everyone leaves.
          </p>
          <div className="card-actions">
            <button className="btn btn-primary" onClick={createRoom} disabled={busy}>
              {busy ? 'Creating…' : 'Create a room'}
            </button>
          </div>
          {error && (
            <p role="alert" style={{ marginTop: 14, marginBottom: 0 }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
