import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Home } from './routes/Home';
import { RoomPage } from './routes/RoomPage';
import { Expired } from './routes/Expired';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* host arrives here, with the token in the fragment */}
        <Route path="/r/:roomId" element={<RoomPage claimedRole="host" />} />
        <Route path="/r/:roomId/e/:token" element={<RoomPage claimedRole="editor" />} />
        <Route path="/r/:roomId/v/:token" element={<RoomPage claimedRole="viewer" />} />
        <Route path="*" element={<Expired reason="notFound" />} />
      </Routes>
    </BrowserRouter>
  );
}
