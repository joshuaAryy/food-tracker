import { app } from './app.js';
import { emitServerDiagnostic } from './lib/diagnostics.js';
import { prisma } from './lib/prisma.js';

const port = Number(process.env.PORT ?? 3000);

const server = app.listen(port, '0.0.0.0', () => {
  emitServerDiagnostic('server_started', { operation: 'api_server' });
});

async function shutdown(): Promise<void> {
  server.close();
  await prisma.$disconnect();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
