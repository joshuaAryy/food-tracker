import 'tsx/cjs';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { withEntitlementsPlist, type ConfigPlugin } from 'expo/config-plugins';
import { isAppleSignInEnabled } from './src/lib/apple-sign-in-config';
import {
  APP_VERSION,
  IOS_BUILD_NUMBER,
  IOS_DEPLOYMENT_TARGET,
} from './src/lib/app-metadata';
import { validateApiTarget } from './src/lib/api-target';
import withReleaseBundleSafety from './config-plugins/with-release-bundle-safety';
import withIosDeploymentTarget from './config-plugins/with-ios-deployment-target';
import withIosSceneLifecycle from './config-plugins/with-ios-scene-lifecycle';

export type AppEnvironment = 'development' | 'staging' | 'production';

export function removeAppleSignInNativeConfiguration(
  entitlements: Record<string, unknown>,
): Record<string, unknown> {
  const nextEntitlements = { ...entitlements };
  delete nextEntitlements['com.apple.developer.applesignin'];
  return nextEntitlements;
}

const withDisabledAppleSignInNativeConfiguration: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (config) => {
    config.modResults = removeAppleSignInNativeConfiguration(config.modResults);
    return config;
  });

function assertEnvironment(value: string): asserts value is AppEnvironment {
  if (!['development', 'staging', 'production'].includes(value)) {
    throw new Error(`APP_ENV must be development, staging, or production.`);
  }
}

export function validateApiUrl(
  value: string | undefined,
  environment: AppEnvironment,
): string {
  if (value?.trim() === undefined || value.trim() === '') {
    if (environment === 'development') {
      throw new Error('EXPO_PUBLIC_API_URL is required for development.');
    }
    throw new Error(`EXPO_PUBLIC_API_URL is required for ${environment}.`);
  }

  try {
    return validateApiTarget(value, environment);
  } catch {
    if (environment === 'development') {
      throw new Error('EXPO_PUBLIC_API_URL must be a valid URL.');
    }
    throw new Error(
      `EXPO_PUBLIC_API_URL must use a public HTTPS host for ${environment}.`,
    );
  }
}

export function createAppConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ExpoConfig {
  const appEnv = environment.APP_ENV?.trim() || 'development';
  assertEnvironment(appEnv);
  const apiUrl = validateApiUrl(environment.EXPO_PUBLIC_API_URL, appEnv);
  const googleIosUrlScheme = environment.GOOGLE_IOS_URL_SCHEME?.trim();
  const googleServicesPlistPath =
    environment.GOOGLE_SERVICES_PLIST_PATH?.trim();
  const appleSignInEnabled = isAppleSignInEnabled(environment);

  const config: ExpoConfig = {
    name: 'Food Tracker',
    slug: 'food-tracker',
    version: APP_VERSION,
    orientation: 'portrait',
    icon: './assets/icons/simple.png',
    scheme: 'foodtracker',
    userInterfaceStyle: 'light',
    plugins: [
      'expo-router',
      'expo-notifications',
      [
        'expo-dev-client',
        {
          toolsButton: false,
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission:
            'Allow Food Tracker to use the camera for barcode scanning and food photos.',
          barcodeScannerEnabled: true,
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow Food Tracker to choose a food photo for one-time analysis. Photos are not retained.',
        },
      ],
      [
        'expo-alternate-app-icons',
        [
          {
            name: 'ComplexMode',
            ios: './assets/icons/complex.png',
            android: {
              foregroundImage: './assets/icons/complex.png',
              backgroundColor: '#FFFFFF',
            },
          },
        ],
      ],
      ...(appleSignInEnabled
        ? ['expo-apple-authentication']
        : [withDisabledAppleSignInNativeConfiguration]),
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      [
        'expo-build-properties',
        {
          ios: { useFrameworks: 'static' },
        },
      ],
      withReleaseBundleSafety,
      withIosDeploymentTarget,
      withIosSceneLifecycle,
    ],
    extra: {
      apiUrl,
      appEnvironment: appEnv,
    },
    experiments: { typedRoutes: true },
    ios: {
      icon: './assets/icons/simple.png',
      buildNumber: IOS_BUILD_NUMBER,
      deploymentTarget: IOS_DEPLOYMENT_TARGET,
      bundleIdentifier: 'ca.joshuaaryeetey.foodtracker',
      ...(appleSignInEnabled ? { usesAppleSignIn: true } : {}),
      ...(googleServicesPlistPath === undefined
        ? {}
        : { googleServicesFile: googleServicesPlistPath }),
      ...(googleIosUrlScheme === undefined
        ? {}
        : {
            infoPlist: {
              CFBundleURLTypes: [{ CFBundleURLSchemes: [googleIosUrlScheme] }],
            },
          }),
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/icons/simple.png',
        backgroundColor: '#FFFFFF',
      },
      permissions: [
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
      ],
      package: 'com.anonymous.foodtracker',
    },
  };

  return config;
}

export default (_context: ConfigContext): ExpoConfig => {
  void _context;
  return createAppConfig();
};
