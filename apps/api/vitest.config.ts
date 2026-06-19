import { defineConfig } from 'vitest/config';

const DEFAULT_TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/food_tracker_test';

function testDatabaseUrl(): string {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL_TEST ??
    DEFAULT_TEST_DATABASE_URL;
  const databaseName = new URL(databaseUrl).pathname.slice(1);

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests against database "${databaseName}". Test database names must end in "_test".`,
    );
  }

  return databaseUrl;
}

const databaseUrl = testDatabaseUrl();
process.env.DATABASE_URL = databaseUrl;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    hookTimeout: 30_000,
    testTimeout: 15_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: '../../coverage/api',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
    },
  },
});
