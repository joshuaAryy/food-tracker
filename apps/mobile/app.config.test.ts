import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import packageJson from './package.json';
import {
  createAppConfig,
  removeRemotePushNativeConfiguration,
  removeAppleSignInNativeConfiguration,
  validateApiUrl,
  withDisabledRemotePushNativeConfiguration,
} from './app.config';
import withReleaseBundleSafety from './config-plugins/with-release-bundle-safety';
import withIosDeploymentTarget from './config-plugins/with-ios-deployment-target';
import withIosSceneLifecycle from './config-plugins/with-ios-scene-lifecycle';

describe('tracked Expo configuration', () => {
  it('loads the external TypeScript helper through the Expo config loader', () => {
    const result = spawnSync(
      'corepack',
      [
        'pnpm',
        '--filter',
        '@food-tracker/mobile',
        'exec',
        'expo',
        'config',
        '--type',
        'public',
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED: 'false',
        },
        stdio: 'ignore',
      },
    );

    expect(result.status).toBe(0);
  }, 15_000);

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

  it('shares the runtime API-target contract for production and private hosts', () => {
    expect(validateApiUrl('https://api.example.com/api/v1', 'production')).toBe(
      'https://api.example.com/api/v1',
    );
    expect(() =>
      validateApiUrl('http://10.0.0.5/api/v1', 'production'),
    ).toThrow('public HTTPS host');
    expect(() =>
      validateApiUrl('https://api.example.com/api/v2', 'staging'),
    ).toThrow('public HTTPS host');
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
      version: '0.1.0',
      scheme: 'foodtracker',
      icon: './assets/icons/simple.png',
      experiments: { typedRoutes: true },
      extra: {
        apiUrl: 'https://staging-api.example.com/api/v1',
        appEnvironment: 'staging',
        remotePushEnabled: false,
      },
      ios: {
        bundleIdentifier: 'ca.joshuaaryeetey.foodtracker',
        buildNumber: '1',
        deploymentTarget: '16.4',
        icon: './assets/icons/simple.png',
        googleServicesFile: '/tmp/staging/GoogleService-Info.plist',
      },
    });
    expect(config.buildNumber).toBeUndefined();
    expect(config.ios?.buildNumber).toBe('1');
    expect(config.ios?.deploymentTarget).toBe('16.4');
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
      EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED: 'true',
    });
    const plugins = config.plugins ?? [];
    expect(plugins).toContain('@react-native-firebase/app');
    expect(plugins).toContain('@react-native-firebase/auth');
    expect(plugins).not.toContain('expo-notifications');
    expect(plugins).toContain('expo-apple-authentication');
    expect(plugins).toContainEqual(['expo-dev-client', { toolsButton: false }]);
    expect(plugins).toContainEqual([
      'expo-build-properties',
      { ios: { useFrameworks: 'static' } },
    ]);
    expect(plugins).toContain(withReleaseBundleSafety);
    expect(plugins).toContain(withIosDeploymentTarget);
    expect(plugins).toContain(withIosSceneLifecycle);
    expect(config.ios?.googleServicesFile).toBeUndefined();
  });

  it('omits Apple capability and plugin for free development configuration', () => {
    const config = createAppConfig({
      APP_ENV: 'development',
      EXPO_PUBLIC_API_URL: 'http://localhost:3000/api/v1',
      EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED: 'false',
    });
    const plugins = config.plugins ?? [];

    expect(config.ios?.usesAppleSignIn).toBeUndefined();
    expect(plugins).not.toContain('expo-apple-authentication');
    expect(plugins).toContain('@react-native-firebase/app');
    expect(plugins).toContain('@react-native-firebase/auth');
    expect(plugins).toContainEqual([
      'expo-build-properties',
      { ios: { useFrameworks: 'static' } },
    ]);
    expect(config).toMatchObject({
      name: 'Food Tracker',
      version: '0.1.0',
      scheme: 'foodtracker',
      icon: './assets/icons/simple.png',
      experiments: { typedRoutes: true },
      ios: {
        bundleIdentifier: 'ca.joshuaaryeetey.foodtracker',
        buildNumber: '1',
        icon: './assets/icons/simple.png',
      },
    });
    expect(config.buildNumber).toBeUndefined();
    expect(config.ios?.buildNumber).toBe('1');
  });

  it('removes the auto-applied Apple entitlement when Apple is disabled', () => {
    expect(
      removeAppleSignInNativeConfiguration({
        'com.apple.developer.applesignin': ['Default'],
        'aps-environment': 'development',
      }),
    ).toEqual({ 'aps-environment': 'development' });
  });

  it('removes only the remote push entitlement when remote push is disabled', () => {
    expect(
      removeRemotePushNativeConfiguration({
        'aps-environment': 'development',
        'com.apple.developer.applesignin': ['Default'],
        unrelated: 'value',
      }),
    ).toEqual({
      'com.apple.developer.applesignin': ['Default'],
      unrelated: 'value',
    });
  });

  it('omits remote push plugin and exposes disabled capability by default', () => {
    const config = createAppConfig({
      APP_ENV: 'development',
      EXPO_PUBLIC_API_URL: 'http://localhost:3000/api/v1',
      EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED: 'false',
    });
    expect(config.extra).toMatchObject({ remotePushEnabled: false });
    expect(config.plugins).not.toContain('expo-notifications');
    expect(config.plugins).toContain(withDisabledRemotePushNativeConfiguration);
  });

  it('includes remote push plugin and capability when explicitly enabled', () => {
    const config = createAppConfig({
      APP_ENV: 'staging',
      EXPO_PUBLIC_API_URL: 'https://staging-api.example.com/api/v1',
      IOS_REMOTE_PUSH_ENABLED: 'true',
    });
    expect(config.extra).toMatchObject({ remotePushEnabled: true });
    expect(config.plugins).toContain('expo-notifications');
  });

  it('rejects a production build with remote push disabled', () => {
    expect(() =>
      createAppConfig({
        APP_ENV: 'production',
        EXPO_PUBLIC_API_URL: 'https://api.example.com/api/v1',
        IOS_REMOTE_PUSH_ENABLED: 'false',
      }),
    ).toThrow('Production builds require IOS_REMOTE_PUSH_ENABLED=true.');
  });

  it('enables Apple capability and plugin exactly once when configured', () => {
    const config = createAppConfig({
      APP_ENV: 'staging',
      EXPO_PUBLIC_API_URL: 'https://staging-api.example.com/api/v1',
      EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED: 'true',
    });
    const plugins = config.plugins ?? [];

    expect(config.ios?.usesAppleSignIn).toBe(true);
    expect(
      plugins.filter((plugin) => plugin === 'expo-apple-authentication'),
    ).toHaveLength(1);
  });

  it('rejects malformed Apple availability configuration', () => {
    expect(() =>
      createAppConfig({
        APP_ENV: 'development',
        EXPO_PUBLIC_API_URL: 'http://localhost:3000/api/v1',
        EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED: 'TRUE',
      }),
    ).toThrow(
      'EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED must be exactly "true" or "false" when set.',
    );
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
