import { useNavigate } from 'react-router-dom';
import { CLOSE_TEXT, type CloseReason } from '@shared/types';
import { Header } from '../components/Header';

interface Props {
  reason: CloseReason;
}

const HEADING: Record<CloseReason, string> = {
  ended: 'Room closed',
  hostLeft: 'Room closed',
  removed: 'Removed from the room',
  expired: 'Room expired',
  notFound: 'Room not available',
  badToken: 'Link not valid',
  full: 'Room is full',
};

/** A dead link gets an explanation, never a blank editor (R7). */
export function Expired({ reason }: Props) {
  const navigate = useNavigate();

  return (
    <div className="app">
      <Header />
      <div className="centre">
        <div className="card">
          <h1>{HEADING[reason]}</h1>
          <p>{CLOSE_TEXT[reason]}</p>
          <p>
            Rooms are temporary and nothing is stored, so the code in a closed room
            cannot be recovered.
          </p>
          <div className="card-actions">
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Create a new room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
