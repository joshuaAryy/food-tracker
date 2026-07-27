import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import packageJson from './package.json';
import { createAppConfig, validateApiUrl } from './app.config';

describe('tracked Expo configuration', () => {
  it('rejects a missing API URL outside local development', () => {
    expect(() => validateApiUrl(undefined, 'staging')).toThrow(
      'EXPO_PUBLIC_API_URL is required for staging.',
    );
  });

  it.each([
    'http://localhost:3000/api/v1',
    'https://127.0.0.1/api/v1',
    'https://192.168.1.42/api/v1',
    'https://10.0.0.5/api/v1',
    'https://172.16.0.4/api/v1',
    'https://169.254.1.2/api/v1',
    'https://user:password@example.com/api/v1',
    'https://api.example.com/api/v1?debug=true',
    'https://api.example.com/api/v1#fragment',
  ])('rejects unsafe staging/production API URL %s', (value) => {
    expect(() => validateApiUrl(value, 'staging')).toThrow();
    expect(() => validateApiUrl(value, 'production')).toThrow();
  });

  it('accepts explicit local development and public HTTPS staging URLs', () => {
    expect(validateApiUrl('http://localhost:3000/api/v1', 'development')).toBe(
      'http://localhost:3000/api/v1',
    );
    expect(
      validateApiUrl('https://staging-api.example.com/api/v1', 'staging'),
    ).toBe('https://staging-api.example.com/api/v1');
  });

  it('creates the approved tracked config without reading protected app.json', () => {
    const config = createAppConfig({
      APP_ENV: 'staging',
      EXPO_PUBLIC_API_URL: 'https://staging-api.example.com/api/v1',
      GOOGLE_SERVICES_PLIST_PATH: '/tmp/staging/GoogleService-Info.plist',
      GOOGLE_IOS_URL_SCHEME: 'com.googleusercontent.apps.staging',
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'staging-web-client-id',
    });

    expect(config).toMatchObject({
      name: 'Food Tracker',
      scheme: 'foodtracker',
      icon: './assets/icons/simple.png',
      experiments: { typedRoutes: true },
      ios: {
        bundleIdentifier: 'ca.joshuaaryeetey.foodtracker',
        appleTeamId: '6JMW7252B6',
        icon: './assets/icons/simple.png',
        googleServicesFile: '/tmp/staging/GoogleService-Info.plist',
      },
    });
    expect(JSON.stringify(config)).not.toContain('staging-web-client-id');
  });

  it('does not ship a localhost API fallback in the mobile client', () => {
    const source = readFileSync(
      new URL('./src/lib/api-client.ts', import.meta.url),
      'utf8',
    );

    expect(source).not.toMatch(/http:\/\/localhost/);
  });

  it('includes the native authentication config plugins without a real plist', () => {
    const config = createAppConfig({
      APP_ENV: 'staging',
      EXPO_PUBLIC_API_URL: 'https://staging-api.example.com/api/v1',
    });
    const plugins = config.plugins ?? [];
    expect(plugins).toContain('expo-apple-authentication');
    expect(
      plugins.some(
        (plugin) =>
          Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
      ),
    ).toBe(true);
    expect(config.ios?.googleServicesFile).toBeUndefined();
  });

  it('keeps the locked authentication dependency boundary', () => {
    expect(packageJson.dependencies['@react-native-firebase/app']).toBe(
      '25.1.0',
    );
    expect(packageJson.dependencies['@react-native-firebase/auth']).toBe(
      '25.1.0',
    );
    expect(
      packageJson.dependencies['@react-native-google-signin/google-signin'],
    ).toBe('16.1.2');
    expect(packageJson.devDependencies['jest-expo']).toBe('~56.0.5');
    expect(packageJson.devDependencies['react-test-renderer']).toBeUndefined();
    expect(
      packageJson.devDependencies['@react-native/jest-preset'],
    ).toBeUndefined();
  });
});
