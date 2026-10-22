import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { NamePrompt } from './components/NamePrompt';
import { identity } from './lib/identity';
import { useStore } from './lib/store';
import { Home } from './routes/Home';
import { Expired } from './routes/Expired';

// The room pulls in CodeMirror and the language registry, which is the bulk of the
// bundle. Loading it only when someone enters a room keeps the landing page small,
// which matters most on a phone over mobile data (R40).
const RoomPage = lazy(() =>
  import('./routes/RoomPage').then((m) => ({ default: m.RoomPage })),
);

function Loading() {
  return (
    <div className="app">
      <Header />
      <div className="centre">
        <p className="muted">Opening the room…</p>
      </div>
    </div>
  );
}

export function App() {
  const { name } = useStore(identity);

  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          {/* host arrives here, with the token in the fragment */}
          <Route path="/r/:roomId" element={<RoomPage claimedRole="host" />} />
          <Route path="/r/:roomId/e/:token" element={<RoomPage claimedRole="editor" />} />
          <Route path="/r/:roomId/v/:token" element={<RoomPage claimedRole="viewer" />} />
          <Route path="*" element={<Expired reason="notFound" />} />
        </Routes>
      </Suspense>
      {/* Overlaid rather than replacing the page, so people can see what the site
          is before being asked to name themselves (R25). */}
      {!name && <NamePrompt />}
    </BrowserRouter>
  );
}
