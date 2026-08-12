import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createStagingSimulatorEnvironment,
  type StagingSimulatorEnvironment,
} from './staging-simulator';
import type { EnvironmentMap } from './staging-release-config';

const temporaryDirectories: string[] = [];

function validEnvironment(): EnvironmentMap {
  const directory = mkdtempSync(join(tmpdir(), 'food-tracker-staging-sim-'));
  temporaryDirectories.push(directory);
  const plistPath = join(directory, 'GoogleService-Info.plist');
  writeFileSync(
    plistPath,
    `<plist><dict>
      <key>BUNDLE_ID</key><string>ca.joshuaaryeetey.foodtracker</string>
      <key>PROJECT_ID</key><string>staging-project</string>
      <key>GOOGLE_APP_ID</key><string>1:123:ios:abc</string>
      <key>CLIENT_ID</key><string>client.apps.googleusercontent.com</string>
      <key>REVERSED_CLIENT_ID</key><string>com.googleusercontent.apps.release</string>
      <key>API_KEY</key><string>public-api-key</string>
    </dict></plist>`,
  );
  return {
    APP_ENV: 'staging',
    EXPO_PUBLIC_APP_ENV: 'staging',
    EXPO_PUBLIC_API_URL: 'https://api.railway.test/api/v1',
    RAILWAY_STAGING_API_HOST: 'api.railway.test',
    EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED: 'false',
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web-client.apps.googleusercontent.com',
    GOOGLE_IOS_URL_SCHEME: 'com.googleusercontent.apps.release',
    GOOGLE_SERVICES_PLIST_PATH: plistPath,
    EXPO_NO_DOTENV: '1',
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('staging Simulator environment', () => {
  it('validates staging and removes unsafe inherited bundling flags', () => {
    const result: StagingSimulatorEnvironment =
      createStagingSimulatorEnvironment(validEnvironment(), {
        EXPO_NO_CLIENT_ENV_VARS: '1',
        SKIP_BUNDLING: '1',
        NODE_ENV: 'development',
      });

    expect(result.config.appEnvironment).toBe('staging');
    expect(result.environment.EXPO_NO_DOTENV).toBe('1');
    expect(result.environment.EXPO_NO_CLIENT_ENV_VARS).toBeUndefined();
    expect(result.environment.SKIP_BUNDLING).toBeUndefined();
    expect(result.environment.NODE_ENV).toBe('development');
  });

  it('rejects a non-staging target before starting Metro', () => {
    expect(() =>
      createStagingSimulatorEnvironment({
        ...validEnvironment(),
        APP_ENV: 'production',
      }),
    ).toThrow('staging');
  });
});
