import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    'process.env.EXPO_PUBLIC_API_URL': JSON.stringify(
      'http://localhost:3000/api/v1',
    ),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'app.config.test.ts'],
  },
});
