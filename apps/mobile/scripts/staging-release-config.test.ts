import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  classifyStagingReleaseVariables,
  createStagingReleaseXcodeEnvironment,
  type EnvironmentMap,
  parseStagingReleaseEnvFile,
  sanitizeStagingReleaseConfiguration,
  validateFirebasePlist,
  validateGoogleIosUrlScheme,
  validateStagingReleaseEnvFileVariables,
  validateStagingReleaseEnvironment,
} from './staging-release-config';

const tempDirectories: string[] = [];
const reversedClientId = 'com.googleusercontent.apps.release-client';

function createPlist(): string {
  const directory = mkdtempSync(join(tmpdir(), 'food-tracker-phase17-'));
  tempDirectories.push(directory);
  const filePath = join(directory, 'GoogleService-Info.plist');
  writeFileSync(
    filePath,
    `<?xml version="1.0"?><plist><dict>
      <key>BUNDLE_ID</key><string>ca.joshuaaryeetey.foodtracker</string>
      <key>PROJECT_ID</key><string>staging-project</string>
      <key>GOOGLE_APP_ID</key><string>1:123:ios:abc</string>
      <key>CLIENT_ID</key><string>client.apps.googleusercontent.com</string>
      <key>REVERSED_CLIENT_ID</key><string>${reversedClientId}</string>
      <key>API_KEY</key><string>public-api-key</string>
    </dict></plist>`,
  );
  return filePath;
}

function validEnvironment(): EnvironmentMap {
  return {
    APP_ENV: 'staging',
    EXPO_PUBLIC_APP_ENV: 'staging',
    EXPO_PUBLIC_API_URL: 'https://api.railway.test/api/v1',
    RAILWAY_STAGING_API_HOST: 'api.railway.test',
    EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED: 'false',
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web-client.apps.googleusercontent.com',
    GOOGLE_IOS_URL_SCHEME: reversedClientId,
    GOOGLE_SERVICES_PLIST_PATH: createPlist(),
    EXPO_NO_DOTENV: '1',
  };
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('staging Release configuration', () => {
  it('accepts a valid Railway staging public configuration', () => {
    const result = validateStagingReleaseEnvironment(validEnvironment(), {
      requireRailwayHost: true,
    });
    expect(result.appEnvironment).toBe('staging');
    expect(result.apiUrl).toBe('https://api.railway.test/api/v1');
    expect(result.sanitized.sensitiveValues).toBe('not-printed');
  });

  it('requires the pinned staging host to match the public API target', () => {
    expect(() =>
      validateStagingReleaseEnvironment(
        {
          ...validEnvironment(),
          RAILWAY_STAGING_API_HOST: 'other.railway.test',
        },
        { requireRailwayHost: true },
      ),
    ).toThrow('match the Railway staging host');
    expect(() =>
      validateStagingReleaseEnvironment(
        { ...validEnvironment(), RAILWAY_STAGING_API_HOST: undefined },
        { requireRailwayHost: true },
      ),
    ).toThrow('RAILWAY_STAGING_API_HOST');
  });

  it.each([
    'http://localhost:3000/api/v1',
    'https://127.0.0.1/api/v1',
    'https://192.168.1.4/api/v1',
    'https://api.railway.test/wrong',
    'not-a-url',
  ])('rejects unsafe API target %s', (apiUrl) => {
    expect(() =>
      validateStagingReleaseEnvironment({
        ...validEnvironment(),
        EXPO_PUBLIC_API_URL: apiUrl,
      }),
    ).toThrow();
  });

  it('requires staging selectors and dotenv guards', () => {
    expect(() =>
      validateStagingReleaseEnvironment({
        ...validEnvironment(),
        APP_ENV: 'development',
      }),
    ).toThrow('APP_ENV and EXPO_PUBLIC_APP_ENV must both be staging.');
    expect(() =>
      validateStagingReleaseEnvironment({
        ...validEnvironment(),
        EXPO_NO_DOTENV: '0',
      }),
    ).toThrow('EXPO_NO_DOTENV=1');
    expect(() =>
      validateStagingReleaseEnvironment({
        ...validEnvironment(),
        EXPO_NO_CLIENT_ENV_VARS: '0',
      }),
    ).toThrow('EXPO_NO_CLIENT_ENV_VARS');
  });

  it('rejects server secrets and unapproved public variables', () => {
    expect(() =>
      validateStagingReleaseEnvironment({
        ...validEnvironment(),
        DATABASE_URL: 'postgresql://secret',
      }),
    ).toThrow('DATABASE_URL');
    expect(() =>
      validateStagingReleaseEnvironment({
        ...validEnvironment(),
        EXPO_PUBLIC_FIREBASE_PRIVATE_KEY: 'secret',
      }),
    ).toThrow('EXPO_PUBLIC_FIREBASE_PRIVATE_KEY');
  });

  it('rejects arbitrary variables from the dedicated staging file', () => {
    expect(() =>
      validateStagingReleaseEnvFileVariables({ NODE_OPTIONS: '--inspect' }),
    ).toThrow('NODE_OPTIONS');
    expect(() =>
      validateStagingReleaseEnvFileVariables({ EXPO_NO_CLIENT_ENV_VARS: '0' }),
    ).toThrow('EXPO_NO_CLIENT_ENV_VARS');
  });

  it('validates the Firebase plist and matching Google scheme', () => {
    const path = createPlist();
    const plist = validateFirebasePlist(path);
    expect(plist.bundleIdentifier).toBe('ca.joshuaaryeetey.foodtracker');
    expect(validateGoogleIosUrlScheme(reversedClientId, plist)).toBe(
      reversedClientId,
    );
    expect(() =>
      validateGoogleIosUrlScheme('com.googleusercontent.apps.other', plist),
    ).toThrow('does not match');
  });

  it('fails before prebuild when Firebase public configuration is missing', () => {
    expect(() =>
      validateStagingReleaseEnvironment({
        ...validEnvironment(),
        GOOGLE_SERVICES_PLIST_PATH: undefined,
      }),
    ).toThrow('GOOGLE_SERVICES_PLIST_PATH');
    expect(() =>
      validateStagingReleaseEnvironment({
        ...validEnvironment(),
        GOOGLE_IOS_URL_SCHEME: undefined,
      }),
    ).toThrow('GOOGLE_IOS_URL_SCHEME');
  });

  it('parses only local environment syntax without printing values', () => {
    expect(
      parseStagingReleaseEnvFile(
        'APP_ENV=staging\n# comment\nEXPO_NO_DOTENV="1"\n',
      ),
    ).toEqual({ APP_ENV: 'staging', EXPO_NO_DOTENV: '1' });
    const summary = sanitizeStagingReleaseConfiguration({
      apiUrl: 'https://api.railway.test/api/v1',
      googleIosUrlScheme: reversedClientId,
      firebase: {
        bundleIdentifier: 'ca.joshuaaryeetey.foodtracker',
        projectId: 'secret-project',
        googleAppId: 'secret-app',
        clientId: 'secret-client',
        reversedClientId,
      },
    });
    expect(JSON.stringify(summary)).not.toContain('api.up.railway.app');
    expect(JSON.stringify(summary)).not.toContain(reversedClientId);
    expect(JSON.stringify(summary)).not.toContain('secret-project');
  });

  it('classifies public, build-local, server-only, and unsafe variables', () => {
    expect(
      classifyStagingReleaseVariables({
        EXPO_PUBLIC_API_URL: 'redacted',
        GOOGLE_SERVICES_PLIST_PATH: 'redacted',
        DATABASE_URL: 'redacted',
        PHOTO_ANALYSIS_TIMEOUT_MS: 'redacted',
        EXPO_PUBLIC_UNKNOWN: 'redacted',
      }),
    ).toEqual({
      EXPO_PUBLIC_API_URL: 'public-client',
      GOOGLE_SERVICES_PLIST_PATH: 'build-local',
      DATABASE_URL: 'server-only',
      PHOTO_ANALYSIS_TIMEOUT_MS: 'server-only',
      EXPO_PUBLIC_UNKNOWN: 'unsafe',
    });
  });

  it('serializes only validated staging variables for the Xcode Release handoff', () => {
    const config = validateStagingReleaseEnvironment(validEnvironment(), {
      requireRailwayHost: true,
    });
    const handoff = createStagingReleaseXcodeEnvironment(
      config,
      '/opt/node path/bin/node',
    );

    expect(handoff).toContain('unset EXPO_NO_CLIENT_ENV_VARS');
    expect(handoff).toContain("export EXPO_NO_DOTENV='1'");
    expect(handoff).toContain("export APP_ENV='staging'");
    expect(handoff).toContain("export EXPO_PUBLIC_APP_ENV='staging'");
    expect(handoff).toContain("export NODE_BINARY='/opt/node path/bin/node'");
    expect(handoff).toContain(
      "export EXPO_PUBLIC_API_URL='https://api.railway.test/api/v1'",
    );
    expect(handoff).toContain("export GOOGLE_SERVICES_PLIST_PATH='");
    expect(handoff).not.toContain('DATABASE_URL');
    expect(handoff).not.toContain('RAILWAY_STAGING_API_HOST');
    expect(handoff).not.toMatch(/^export (?:PATH|DATABASE_URL)=/m);
  });

  it('shell-quotes handoff values and is deterministic', () => {
    const config = {
      ...validateStagingReleaseEnvironment(validEnvironment()),
      googleIosUrlScheme: "com.googleusercontent.apps.re'lease",
      firebase: {
        ...validateStagingReleaseEnvironment(validEnvironment()).firebase,
        reversedClientId: "com.googleusercontent.apps.re'lease",
      },
    } satisfies ReturnType<typeof validateStagingReleaseEnvironment>;
    const first = createStagingReleaseXcodeEnvironment(config, '/node');
    const second = createStagingReleaseXcodeEnvironment(config, '/node');

    expect(first).toBe(second);
    expect(first).toContain("'com.googleusercontent.apps.re'\\''lease'");
  });
});
