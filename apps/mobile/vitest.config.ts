import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      'expo-constants': fileURLToPath(
        new URL(
          './node_modules/expo-constants/build/Constants.server.js',
          import.meta.url,
        ),
      ),
    },
  },
  define: {
    'process.env.EXPO_PUBLIC_API_URL': JSON.stringify(
      'http://localhost:3000/api/v1',
    ),
  },
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'app.config.test.ts',
      'config-plugins/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
  },
});
