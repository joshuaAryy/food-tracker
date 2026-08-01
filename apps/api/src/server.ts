import { validateServerEnvironment } from './lib/runtime-config.js';

validateServerEnvironment();

const [{ app }, { emitServerDiagnostic }, { prisma }] = await Promise.all([
  import('./app.js'),
  import('./lib/diagnostics.js'),
  import('./lib/prisma.js'),
]);

const port = Number(process.env.PORT ?? 3000);

const server = app.listen(port, '0.0.0.0', () => {
  emitServerDiagnostic('server_started', { operation: 'api_server' });
  emitServerDiagnostic('api_instance_started', { operation: 'api_server' });
});

async function shutdown(): Promise<void> {
  server.close();
  await prisma.$disconnect();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
