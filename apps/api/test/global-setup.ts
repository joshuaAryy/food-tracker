import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default function globalSetup(): void {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL_TEST ??
    'postgresql://postgres:postgres@localhost:5432/food_tracker_test';
  process.env.DATABASE_URL = databaseUrl;

  const databaseName = new URL(databaseUrl).pathname.slice(1);

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to migrate database "${databaseName}". Test database names must end in "_test".`,
    );
  }

  execFileSync('corepack', ['pnpm', 'exec', 'prisma', 'migrate', 'deploy'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}
