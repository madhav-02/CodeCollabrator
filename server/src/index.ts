import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { LIMITS } from '@shared/types';
import { config } from './config';
import { handleHttp } from './http';
import { handleJoin } from './join';
import { originAllowed } from './origin';

const server = createServer(handleHttp);

// maxPayload caps a single frame, so one client cannot force a large allocation (N7).
const wss = new WebSocketServer({ noServer: true, maxPayload: LIMITS.maxFrameBytes });

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url ?? '/', `http://${config.host}`);

  if (pathname !== '/ws') {
    socket.destroy();
    return;
  }

  // Refused before the upgrade completes, so a disallowed origin never gets a
  // socket at all (N6).
  if (!originAllowed(req.headers.origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => handleJoin(ws, req));
});

server.listen(config.port, config.host, () => {
  console.log(`[livecode] http://${config.host}:${config.port}`);
  if (!config.production) {
    console.log('[livecode] development: open the vite url on port 5173');
  }
});

function shutdown(signal: string): void {
  console.log(`[livecode] ${signal} — shutting down`);
  for (const client of wss.clients) client.close(1001, 'server shutting down');
  wss.close();
  server.close(() => process.exit(0));
  // Rooms live in memory and are expected to be lost on restart (N2).
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
