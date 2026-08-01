import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'test/error-disclosure.test.ts',
      'test/diagnostics-redaction.test.ts',
      'test/request-context.test.ts',
      'test/express-hardening.test.ts',
      'test/auth-contracts.test.ts',
      'test/firebase-user-schema.test.ts',
      'test/firebase-token-verifier.test.ts',
      'test/firebase-revocation-status.test.ts',
      'test/firebase-admin-adapter.test.ts',
      'test/firebase-user-synchronization.test.ts',
      'test/authentication-middleware.test.ts',
      'test/authentication-diagnostic-categories.test.ts',
      'test/rate-limit-key.test.ts',
      'test/runtime-config.test.ts',
      'test/health.test.ts',
      'test/deployment-config.test.ts',
    ],
  },
});
