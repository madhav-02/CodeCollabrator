import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { LIMITS } from '@shared/types';
import { config } from './config';
import { handleHttp } from './http';

const server = createServer(handleHttp);

// maxPayload caps a single frame, so one client cannot force a large allocation (N7).
const wss = new WebSocketServer({ noServer: true, maxPayload: LIMITS.maxFrameBytes });

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url ?? '/', `http://${config.host}`);

  if (pathname !== '/ws') {
    socket.destroy();
    return;
  }

  // Origin checking, token verification and room routing arrive in T2.3. Until
  // then the plumbing is in place but no connection is allowed to proceed.
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.close(1011, 'rooms not implemented yet');
  });
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
