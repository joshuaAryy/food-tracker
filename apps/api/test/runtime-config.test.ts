import { describe, expect, it } from 'vitest';
import { validateServerEnvironment } from '../src/lib/runtime-config.js';

describe('server runtime configuration', () => {
  it('keeps local development deterministic without production secrets', () => {
    expect(() =>
      validateServerEnvironment({ APP_ENV: 'development' }),
    ).not.toThrow();
    expect(() => validateServerEnvironment({ APP_ENV: 'test' })).not.toThrow();
  });

  it('requires server-only staging and production configuration by name', () => {
    for (const appEnvironment of ['staging', 'production']) {
      expect(() =>
        validateServerEnvironment({ APP_ENV: appEnvironment }),
      ).toThrow(
        /DATABASE_URL.*CORS_ORIGINS.*FIREBASE_PROJECT_ID.*FIREBASE_CLIENT_EMAIL.*FIREBASE_PRIVATE_KEY.*RATE_LIMIT_KEY_SECRET/,
      );
    }
  });

  it('does not include configured values in a validation error', () => {
    expect(() =>
      validateServerEnvironment({
        APP_ENV: 'production',
        DATABASE_URL: 'database-configured-value',
        CORS_ORIGINS: '*',
        FIREBASE_PROJECT_ID: 'firebase-project-configured-value',
        FIREBASE_CLIENT_EMAIL: 'firebase-client-configured-value',
        FIREBASE_PRIVATE_KEY: 'firebase-private-key-configured-value',
        RATE_LIMIT_KEY_SECRET: 'rate-limit-secret-configured-value',
      }),
    ).toThrowError(
      expect.objectContaining({
        message: expect.not.stringContaining('configured-value'),
      }),
    );
  });

  it('requires hosted food search configuration', () => {
    expect(() =>
      validateServerEnvironment({
        APP_ENV: 'staging',
        DATABASE_URL: 'database-configured',
        CORS_ORIGINS: 'https://web.example.test',
        FIREBASE_PROJECT_ID: 'firebase-project-configured',
        FIREBASE_CLIENT_EMAIL: 'firebase-client-configured',
        FIREBASE_PRIVATE_KEY: 'firebase-private-key-configured',
        RATE_LIMIT_KEY_SECRET: 'rate-limit-secret-configured',
      }),
    ).toThrow(/USDA_FDC_API_KEY/);
  });

  it('accepts complete explicit production configuration', () => {
    expect(() =>
      validateServerEnvironment({
        APP_ENV: 'production',
        DATABASE_URL: 'database-configured',
        CORS_ORIGINS: 'https://web.example.test',
        FIREBASE_PROJECT_ID: 'firebase-project-configured',
        FIREBASE_CLIENT_EMAIL: 'firebase-client-configured',
        FIREBASE_PRIVATE_KEY: 'firebase-private-key-configured',
        RATE_LIMIT_KEY_SECRET: 'rate-limit-secret-configured',
        USDA_FDC_API_KEY: 'usda-key-configured',
      }),
    ).not.toThrow();
  });

  it('requires Gemini credentials when hosted AI is enabled', () => {
    expect(() =>
      validateServerEnvironment({
        APP_ENV: 'staging',
        DATABASE_URL: 'database-configured',
        CORS_ORIGINS: 'https://web.example.test',
        FIREBASE_PROJECT_ID: 'firebase-project-configured',
        FIREBASE_CLIENT_EMAIL: 'firebase-client-configured',
        FIREBASE_PRIVATE_KEY: 'firebase-private-key-configured',
        RATE_LIMIT_KEY_SECRET: 'rate-limit-secret-configured',
        USDA_FDC_API_KEY: 'usda-key-configured',
        AI_PROVIDER: 'gemini',
      }),
    ).toThrow(/GEMINI_API_KEY/);
  });

  it('rejects mock AI configuration in hosted environments', () => {
    expect(() =>
      validateServerEnvironment({
        APP_ENV: 'staging',
        DATABASE_URL: 'database-configured',
        CORS_ORIGINS: 'https://web.example.test',
        FIREBASE_PROJECT_ID: 'firebase-project-configured',
        FIREBASE_CLIENT_EMAIL: 'firebase-client-configured',
        FIREBASE_PRIVATE_KEY: 'firebase-private-key-configured',
        RATE_LIMIT_KEY_SECRET: 'rate-limit-secret-configured',
        USDA_FDC_API_KEY: 'usda-key-configured',
        AI_PROVIDER: 'mock',
      }),
    ).toThrow(/AI_PROVIDER/);
  });

  it('requires Gemini and proof configuration for enabled photo features', () => {
    expect(() =>
      validateServerEnvironment({
        APP_ENV: 'staging',
        DATABASE_URL: 'database-configured',
        CORS_ORIGINS: 'https://web.example.test',
        FIREBASE_PROJECT_ID: 'firebase-project-configured',
        FIREBASE_CLIENT_EMAIL: 'firebase-client-configured',
        FIREBASE_PRIVATE_KEY: 'firebase-private-key-configured',
        RATE_LIMIT_KEY_SECRET: 'rate-limit-secret-configured',
        USDA_FDC_API_KEY: 'usda-key-configured',
        PHOTO_CANDIDATE_ADJUDICATION_ENABLED: 'true',
      }),
    ).toThrow(/AI_PROVIDER|GEMINI_API_KEY/);

    expect(() =>
      validateServerEnvironment({
        APP_ENV: 'staging',
        DATABASE_URL: 'database-configured',
        CORS_ORIGINS: 'https://web.example.test',
        FIREBASE_PROJECT_ID: 'firebase-project-configured',
        FIREBASE_CLIENT_EMAIL: 'firebase-client-configured',
        FIREBASE_PRIVATE_KEY: 'firebase-private-key-configured',
        RATE_LIMIT_KEY_SECRET: 'rate-limit-secret-configured',
        USDA_FDC_API_KEY: 'usda-key-configured',
        AI_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'gemini-key-configured',
        PHOTO_ESTIMATE_CONFIRMATION_ENABLED: 'true',
      }),
    ).toThrow(/PHOTO_ESTIMATE_PROOF_SECRET/);
  });
});
