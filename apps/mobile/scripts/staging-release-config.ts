import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { validateApiTarget } from '../src/lib/api-target';

export const STAGING_RELEASE_PUBLIC_VARIABLES = [
  'EXPO_PUBLIC_APP_ENV',
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
] as const;

export const STAGING_RELEASE_BUILD_VARIABLES = [
  'APP_ENV',
  'RAILWAY_STAGING_API_HOST',
  'GOOGLE_SERVICES_PLIST_PATH',
  'GOOGLE_IOS_URL_SCHEME',
  'EXPO_NO_DOTENV',
] as const;

const SERVER_VARIABLE_NAMES = new Set([
  'DATABASE_URL',
  'DATABASE_URL_TEST',
  'TEST_DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'RATE_LIMIT_KEY_SECRET',
  'GEMINI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'USDA_API_KEY',
  'OPEN_FOOD_FACTS_API_KEY',
  'PHOTO_ESTIMATE_PROOF_SECRET',
  'PORT',
  'CORS_ORIGINS',
  'AI_PROVIDER',
  'GEMINI_FOOD_PARSE_MODEL',
  'GEMINI_PHOTO_ANALYSIS_MODEL',
  'USDA_FDC_API_KEY',
  'USDA_FDC_BASE_URL',
]);

const EXPECTED_BUNDLE_IDENTIFIER = 'ca.joshuaaryeetey.foodtracker';
export type EnvironmentMap = Record<string, string | undefined>;

export interface FirebasePlistSummary {
  bundleIdentifier: string;
  projectId: string;
  googleAppId: string;
  clientId: string;
  reversedClientId: string;
}

export interface StagingReleaseConfig {
  apiUrl: string;
  appEnvironment: 'staging';
  googleIosUrlScheme: string;
  googleWebClientId: string;
  googleServicesPlistPath: string;
  firebase: FirebasePlistSummary;
  sanitized: Record<string, string>;
}

export interface StagingReleaseConfigOptions {
  requireRailwayHost?: boolean;
  expectedBundleIdentifier?: string;
}

function nonEmpty(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== '';
}

function isServerVariableName(key: string): boolean {
  return (
    SERVER_VARIABLE_NAMES.has(key) ||
    key.startsWith('PHOTO_') ||
    key.startsWith('GEMINI_') ||
    key.startsWith('USDA_') ||
    key.startsWith('DATABASE_') ||
    key.startsWith('FIREBASE_') ||
    key.startsWith('RATE_LIMIT_')
  );
}

function parsePlistStrings(contents: string): Record<string, string> {
  const values: Record<string, string> = {};
  const pairPattern =
    /<key>\s*([^<]+?)\s*<\/key>\s*<(string|true|false)\b[^>]*>([\s\S]*?)<\/\2>/g;
  for (const match of contents.matchAll(pairPattern)) {
    const key = match[1]?.trim();
    const value = match[3]?.trim();
    if (key !== undefined && value !== undefined) values[key] = value;
  }
  return values;
}

export function validateGoogleIosUrlScheme(
  scheme: string | undefined,
  plist: FirebasePlistSummary,
): string {
  const normalized = scheme?.trim();
  if (!nonEmpty(normalized)) {
    throw new Error(
      'GOOGLE_IOS_URL_SCHEME is required for a staging Release build.',
    );
  }
  if (!normalized.startsWith('com.googleusercontent.apps.')) {
    throw new Error(
      'GOOGLE_IOS_URL_SCHEME must be a Google reversed-client scheme.',
    );
  }
  if (plist.reversedClientId !== normalized) {
    throw new Error('GOOGLE_IOS_URL_SCHEME does not match the Firebase plist.');
  }
  return normalized;
}

export function validateFirebasePlist(
  filePath: string | undefined,
  expectedBundleIdentifier = EXPECTED_BUNDLE_IDENTIFIER,
): FirebasePlistSummary {
  if (!nonEmpty(filePath)) {
    throw new Error(
      'GOOGLE_SERVICES_PLIST_PATH is required for a staging Release build.',
    );
  }
  if (!isAbsolute(filePath)) {
    throw new Error(
      'GOOGLE_SERVICES_PLIST_PATH must be an absolute local path.',
    );
  }

  const absolutePath = resolve(filePath);
  if (!existsSync(absolutePath)) {
    throw new Error('The configured Firebase plist does not exist.');
  }
  const stat = lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('The configured Firebase plist must be a regular file.');
  }

  const contents = readFileSync(absolutePath, 'utf8');
  if (!contents.includes('<plist') || !contents.includes('</plist>')) {
    throw new Error('The configured Firebase plist is not an XML plist.');
  }
  const values = parsePlistStrings(contents);
  const required = [
    'BUNDLE_ID',
    'PROJECT_ID',
    'GOOGLE_APP_ID',
    'CLIENT_ID',
    'REVERSED_CLIENT_ID',
    'API_KEY',
  ] as const;
  for (const key of required) {
    if (!nonEmpty(values[key])) {
      throw new Error(
        `The Firebase plist is missing required public key ${key}.`,
      );
    }
  }
  if (values.BUNDLE_ID !== expectedBundleIdentifier) {
    throw new Error(
      'The Firebase plist bundle identifier does not match the app.',
    );
  }

  return {
    bundleIdentifier: values.BUNDLE_ID as string,
    projectId: values.PROJECT_ID as string,
    googleAppId: values.GOOGLE_APP_ID as string,
    clientId: values.CLIENT_ID as string,
    reversedClientId: values.REVERSED_CLIENT_ID as string,
  };
}

function validatePublicVariables(environment: EnvironmentMap): void {
  const allowed = new Set<string>(STAGING_RELEASE_PUBLIC_VARIABLES);
  for (const key of Object.keys(environment)) {
    if (key.startsWith('EXPO_PUBLIC_') && !allowed.has(key)) {
      throw new Error(
        `Public mobile variable ${key} is not approved for this build.`,
      );
    }
    if (isServerVariableName(key)) {
      throw new Error(
        `Server-only variable ${key} cannot be supplied to the mobile build.`,
      );
    }
  }
}

export function classifyStagingReleaseVariables(
  environment: EnvironmentMap,
): Record<string, 'public-client' | 'build-local' | 'server-only' | 'unsafe'> {
  const result: Record<
    string,
    'public-client' | 'build-local' | 'server-only' | 'unsafe'
  > = {};
  for (const key of Object.keys(environment)) {
    if (isServerVariableName(key)) result[key] = 'server-only';
    else if (key.startsWith('EXPO_PUBLIC_')) {
      result[key] = STAGING_RELEASE_PUBLIC_VARIABLES.includes(
        key as (typeof STAGING_RELEASE_PUBLIC_VARIABLES)[number],
      )
        ? 'public-client'
        : 'unsafe';
    } else if (
      (STAGING_RELEASE_BUILD_VARIABLES as readonly string[]).includes(key)
    ) {
      result[key] = 'build-local';
    }
  }
  return result;
}

export function parseStagingReleaseEnvFile(contents: string): EnvironmentMap {
  const result: EnvironmentMap = {};
  for (const [lineNumber, sourceLine] of contents.split(/\r?\n/).entries()) {
    const line = sourceLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^(\w+)\s*=\s*(.*)$/.exec(line);
    if (match === null) {
      throw new Error(
        `Staging Release environment line ${lineNumber + 1} is malformed.`,
      );
    }
    const key = match[1];
    if (key === undefined) {
      throw new Error(
        `Staging Release environment line ${lineNumber + 1} is malformed.`,
      );
    }
    let value = match[2] ?? '';
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function loadStagingReleaseEnvFile(filePath: string): EnvironmentMap {
  if (!isAbsolute(filePath)) {
    throw new Error(
      'GOOGLE_SERVICES_PLIST_PATH and the staging environment file path must be absolute.',
    );
  }
  const absolutePath = resolve(filePath);
  if (!existsSync(absolutePath)) {
    throw new Error('The ignored staging Release environment file is missing.');
  }
  const stat = lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(
      'The staging Release environment file must be a regular file.',
    );
  }
  return parseStagingReleaseEnvFile(readFileSync(absolutePath, 'utf8'));
}

export function validateStagingReleaseEnvFileVariables(
  environment: EnvironmentMap,
): void {
  const allowed = new Set<string>([
    ...STAGING_RELEASE_PUBLIC_VARIABLES,
    ...STAGING_RELEASE_BUILD_VARIABLES,
    'EXPO_NO_CLIENT_ENV_VARS',
  ]);
  for (const key of Object.keys(environment)) {
    if (key === 'EXPO_NO_CLIENT_ENV_VARS') {
      throw new Error(
        'EXPO_NO_CLIENT_ENV_VARS must be unset before starting this workflow.',
      );
    }
    if (!allowed.has(key)) {
      throw new Error(
        `Staging Release environment variable ${key} is not approved.`,
      );
    }
  }
}

export function isRailwayStagingApiTarget(
  apiUrl: string,
  expectedHost?: string,
): boolean {
  const actual = new URL(apiUrl);
  if (expectedHost !== undefined && expectedHost.trim() !== '') {
    const expected = new URL(`https://${expectedHost.trim()}/api/v1`);
    if (
      expected.username !== '' ||
      expected.password !== '' ||
      expected.search !== '' ||
      expected.hash !== '' ||
      expected.pathname !== '/api/v1'
    ) {
      return false;
    }
    return (
      actual.hostname.toLowerCase() === expected.hostname.toLowerCase() &&
      actual.port === expected.port
    );
  }
  const hostname = actual.hostname.toLowerCase();
  return (
    hostname.endsWith('.up.railway.app') || hostname.endsWith('.railway.app')
  );
}

export function sanitizeStagingReleaseConfiguration(
  config: Pick<
    StagingReleaseConfig,
    'firebase' | 'apiUrl' | 'googleIosUrlScheme'
  >,
): Record<string, string> {
  return {
    apiTarget: 'railway-staging-public-https',
    apiPath: '/api/v1',
    appEnvironment: 'staging',
    publicVariables: 'approved-only',
    serverVariables: 'excluded',
    firebasePlist: 'validated-public-client-config',
    googleScheme: 'validated-against-firebase-plist',
    bundleIdentifier: 'existing-app-bundle',
    sensitiveValues: 'not-printed',
    sourceValues:
      config.apiUrl.length > 0 && config.googleIosUrlScheme.length > 0
        ? 'loaded'
        : 'missing',
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Creates the small, ignored environment handoff consumed by Expo's generated
 * Xcode scripts. The allowlist is intentional: Xcode must not inherit the
 * caller's server or ambient environment when it embeds a Release bundle.
 */
export function createStagingReleaseXcodeEnvironment(
  config: StagingReleaseConfig,
  nodeBinary: string,
): string {
  const variables: Array<[string, string]> = [
    ['NODE_BINARY', nodeBinary],
    ['APP_ENV', config.appEnvironment],
    ['EXPO_PUBLIC_APP_ENV', config.appEnvironment],
    ['EXPO_PUBLIC_API_URL', config.apiUrl],
    ['EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED', 'false'],
    ['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', config.googleWebClientId],
    ['GOOGLE_IOS_URL_SCHEME', config.googleIosUrlScheme],
    ['GOOGLE_SERVICES_PLIST_PATH', config.googleServicesPlistPath],
    ['EXPO_NO_DOTENV', '1'],
  ];
  return [
    '# Phase 17 generated staging Release Xcode handoff.',
    '# This file is ignored generated state; do not commit or edit it.',
    'unset EXPO_NO_CLIENT_ENV_VARS',
    ...variables.map(([key, value]) => `export ${key}=${shellQuote(value)}`),
    '',
  ].join('\n');
}

export function validateStagingReleaseEnvironment(
  environment: EnvironmentMap,
  options: StagingReleaseConfigOptions = {},
): StagingReleaseConfig {
  validatePublicVariables(environment);
  if (
    Object.prototype.hasOwnProperty.call(environment, 'EXPO_NO_CLIENT_ENV_VARS')
  ) {
    throw new Error('EXPO_NO_CLIENT_ENV_VARS must be unset for this workflow.');
  }
  if (environment.EXPO_NO_DOTENV !== '1') {
    throw new Error('EXPO_NO_DOTENV=1 is required for this workflow.');
  }
  if (
    environment.APP_ENV !== 'staging' ||
    environment.EXPO_PUBLIC_APP_ENV !== 'staging'
  ) {
    throw new Error('APP_ENV and EXPO_PUBLIC_APP_ENV must both be staging.');
  }
  if (environment.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED !== 'false') {
    throw new Error(
      'Apple Sign In must remain disabled for the free Release build.',
    );
  }

  const apiUrl = validateApiTarget(environment.EXPO_PUBLIC_API_URL, 'staging');
  if (options.requireRailwayHost === true) {
    const expectedHost = environment.RAILWAY_STAGING_API_HOST?.trim();
    if (!nonEmpty(expectedHost)) {
      throw new Error(
        'RAILWAY_STAGING_API_HOST is required to identify the staging service.',
      );
    }
    if (!isRailwayStagingApiTarget(apiUrl, expectedHost)) {
      throw new Error(
        'EXPO_PUBLIC_API_URL must match the Railway staging host.',
      );
    }
  }
  const firebase = validateFirebasePlist(
    environment.GOOGLE_SERVICES_PLIST_PATH,
    options.expectedBundleIdentifier ?? EXPECTED_BUNDLE_IDENTIFIER,
  );
  const googleIosUrlScheme = validateGoogleIosUrlScheme(
    environment.GOOGLE_IOS_URL_SCHEME,
    firebase,
  );
  const googleWebClientId =
    environment.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  if (!nonEmpty(googleWebClientId)) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is required for a staging Release build.',
    );
  }

  const config = {
    apiUrl,
    appEnvironment: 'staging' as const,
    googleIosUrlScheme,
    googleWebClientId,
    googleServicesPlistPath: resolve(
      environment.GOOGLE_SERVICES_PLIST_PATH as string,
    ),
    firebase,
  };
  return { ...config, sanitized: sanitizeStagingReleaseConfiguration(config) };
}
