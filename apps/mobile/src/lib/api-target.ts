export type ApiTargetCategory = 'local' | 'staging' | 'invalid/missing';

export const API_BASE_PATH = '/api/v1';

export interface ApiRuntimeExtra {
  apiUrl?: unknown;
  appEnvironment?: unknown;
}

export interface ResolvedApiRuntimeConfig {
  apiUrl: string;
  category: Exclude<ApiTargetCategory, 'invalid/missing'>;
  environment: string;
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const mappedIpv4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized)?.[1];
  if (mappedIpv4 !== undefined) return isLocalHostname(mappedIpv4);
  if (normalized.startsWith('::')) return true;
  if (
    normalized === 'localhost' ||
    normalized === '::' ||
    normalized === '::1' ||
    normalized === '127.0.0.1' ||
    normalized === '0.0.0.0' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local')
  ) {
    return true;
  }

  const parts = normalized.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return (
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      /^fe[89a-f]/.test(normalized) ||
      normalized.startsWith('ff') ||
      normalized.startsWith('2001:db8:') ||
      normalized.startsWith('2001:10:')
    );
  }
  if (parts.some((part) => part < 0 || part > 255)) return true;

  const first = parts[0] ?? -1;
  const second = parts[1] ?? -1;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 192 && second === 0 && parts[2] === 2) ||
    (first === 192 && second === 0 && parts[2] === 0) ||
    (first === 198 && second === 18) ||
    (first === 198 && second === 19) ||
    (first === 198 && second === 51 && parts[2] === 100) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 203 && second === 0 && parts[2] === 113) ||
    first >= 224
  );
}

function parseAndValidateApiUrl(
  value: string | undefined,
  environment: string | undefined,
): { url: URL; category: ApiTargetCategory } {
  if (
    environment !== 'development' &&
    environment !== 'staging' &&
    environment !== 'production'
  ) {
    return {
      url: new URL('https://invalid.example'),
      category: 'invalid/missing',
    };
  }
  const raw = value?.trim();
  if (raw === undefined || raw === '') {
    return {
      url: new URL('https://invalid.example'),
      category: 'invalid/missing',
    };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return {
      url: new URL('https://invalid.example'),
      category: 'invalid/missing',
    };
  }

  if (
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    url.pathname.replace(/\/+$/, '') !== API_BASE_PATH
  ) {
    return { url, category: 'invalid/missing' };
  }

  const local = isLocalHostname(url.hostname);
  if (local) {
    return {
      url,
      category: environment === 'development' ? 'local' : 'invalid/missing',
    };
  }

  if (environment !== 'development' && url.protocol !== 'https:') {
    return { url, category: 'invalid/missing' };
  }

  if (
    environment === 'development' &&
    url.protocol !== 'http:' &&
    url.protocol !== 'https:'
  ) {
    return { url, category: 'invalid/missing' };
  }

  return { url, category: 'staging' };
}

export function validateApiTarget(
  value: string | undefined,
  environment: string | undefined,
): string {
  const { url, category } = parseAndValidateApiUrl(value, environment);
  if (category === 'invalid/missing') {
    throw new Error(
      environment === 'development'
        ? 'EXPO_PUBLIC_API_URL must be a valid development API target.'
        : `EXPO_PUBLIC_API_URL must be a valid public HTTPS ${environment ?? 'staging'} API target.`,
    );
  }

  return `${url.protocol}//${url.host}${API_BASE_PATH}`;
}

export function classifyApiTarget(
  value: string | undefined,
  environment: string | undefined,
): ApiTargetCategory {
  return parseAndValidateApiUrl(value, environment).category;
}

export function resolveApiRuntimeConfig(
  extra: ApiRuntimeExtra | undefined,
): ResolvedApiRuntimeConfig {
  if (
    typeof extra?.apiUrl !== 'string' ||
    typeof extra.appEnvironment !== 'string'
  ) {
    throw new Error('API runtime configuration is unavailable.');
  }

  const apiUrl = extra.apiUrl.trim();
  const environment = extra.appEnvironment.trim();
  let normalizedApiUrl: string;
  try {
    normalizedApiUrl = validateApiTarget(apiUrl, environment);
  } catch {
    throw new Error(
      environment === 'staging'
        ? 'Staging API target must use a public HTTPS host.'
        : 'API runtime configuration is unavailable.',
    );
  }
  const category = classifyApiTarget(normalizedApiUrl, environment);

  if (environment === 'staging' && category !== 'staging') {
    throw new Error('Staging API target must use a public HTTPS host.');
  }
  if (category === 'invalid/missing') {
    throw new Error('API runtime configuration is unavailable.');
  }

  return { apiUrl: normalizedApiUrl, category, environment };
}
