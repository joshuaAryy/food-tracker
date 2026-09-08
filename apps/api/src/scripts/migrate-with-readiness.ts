import { spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { waitForDatabaseReady } from '../lib/migration-readiness.js';

function runPrismaMigrateDeploy(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'corepack',
      ['pnpm', 'exec', 'prisma', 'migrate', 'deploy'],
      { stdio: 'inherit' },
    );
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Prisma migrate deploy exited unsuccessfully (${signal ?? `code ${code ?? 'unknown'}`})`,
        ),
      );
    });
  });
}

const prisma = new PrismaClient();

try {
  await waitForDatabaseReady({
    probe: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
  });
  await prisma.$disconnect();
  console.log('[migration] running Prisma migrate deploy');
  await runPrismaMigrateDeploy();
  console.log('[migration] Prisma migrations applied successfully');
} finally {
  await prisma.$disconnect();
}
