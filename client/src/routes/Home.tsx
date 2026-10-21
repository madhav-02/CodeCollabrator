import { useNavigate } from 'react-router-dom';
import { newRoomId, randomId } from '../lib/ids';
import { Header } from '../components/Header';

export function Home() {
  const navigate = useNavigate();

  // Rooms are minted locally until the server exists (T2.2).
  function createRoom() {
    const roomId = newRoomId();
    navigate(`/r/${roomId}#h=${randomId(21)}`);
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
            <button className="btn btn-primary" onClick={createRoom}>
              Create a room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
