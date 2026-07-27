import type { ConfigContext, ExpoConfig } from 'expo/config';

export type AppEnvironment = 'development' | 'staging' | 'production';

const API_BASE_PATH = '/api/v1';

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isUnsafeHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    isPrivateIpv4(normalized)
  );
}

function assertEnvironment(value: string): asserts value is AppEnvironment {
  if (!['development', 'staging', 'production'].includes(value)) {
    throw new Error(`APP_ENV must be development, staging, or production.`);
  }
}

export function validateApiUrl(
  value: string | undefined,
  environment: AppEnvironment,
): string {
  const raw = value?.trim();
  if (raw === undefined || raw === '') {
    if (environment === 'development') {
      throw new Error('EXPO_PUBLIC_API_URL is required for development.');
    }
    throw new Error(`EXPO_PUBLIC_API_URL is required for ${environment}.`);
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be a valid URL.');
  }

  if (
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    url.pathname.replace(/\/+$/, '') !== API_BASE_PATH
  ) {
    throw new Error(
      'EXPO_PUBLIC_API_URL must not contain credentials, query parameters, fragments, or an unexpected path.',
    );
  }

  if (environment !== 'development' && url.protocol !== 'https:') {
    throw new Error(`EXPO_PUBLIC_API_URL must use HTTPS for ${environment}.`);
  }
  if (environment !== 'development' && isUnsafeHostname(url.hostname)) {
    throw new Error(
      `EXPO_PUBLIC_API_URL must use a public host for ${environment}.`,
    );
  }

  return `${url.protocol}//${url.host}${API_BASE_PATH}`;
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

  const config: ExpoConfig = {
    name: 'Food Tracker',
    slug: 'food-tracker',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icons/simple.png',
    scheme: 'foodtracker',
    userInterfaceStyle: 'light',
    plugins: [
      'expo-router',
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
      'expo-apple-authentication',
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      [
        'expo-build-properties',
        {
          ios: { useFrameworks: 'static' },
        },
      ],
    ],
    experiments: { typedRoutes: true },
    ios: {
      icon: './assets/icons/simple.png',
      bundleIdentifier: 'ca.joshuaaryeetey.foodtracker',
      appleTeamId: '6JMW7252B6',
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

  void apiUrl;
  void appEnv;
  return config;
}

export default (_context: ConfigContext): ExpoConfig => createAppConfig();
