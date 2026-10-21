import { useNavigate } from 'react-router-dom';
import { CLOSE_TEXT, type CloseReason } from '@shared/types';
import { Header } from '../components/Header';

interface Props {
  reason: CloseReason;
}

/** A dead link gets an explanation, never a blank editor (R7). */
export function Expired({ reason }: Props) {
  const navigate = useNavigate();

  return (
    <div className="app">
      <Header />
      <div className="centre">
        <div className="card">
          <h1>{reason === 'notFound' ? 'Nothing here' : 'Room closed'}</h1>
          <p>{CLOSE_TEXT[reason]}</p>
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
