export type ApiTargetCategory = 'local' | 'staging' | 'invalid/missing';

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
  const normalized = hostname.toLowerCase();
  if (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '127.0.0.1' ||
    normalized.endsWith('.localhost')
  ) {
    return true;
  }

  const parts = normalized.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const first = parts[0] ?? -1;
  const second = parts[1] ?? -1;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export function classifyApiTarget(
  value: string | undefined,
  environment: string | undefined,
): ApiTargetCategory {
  const raw = value?.trim();
  if (raw === undefined || raw === '') return 'invalid/missing';

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && environment === 'staging') {
      return 'invalid/missing';
    }
    if (isLocalHostname(url.hostname)) return 'local';
    return 'staging';
  } catch {
    return 'invalid/missing';
  }
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

  const apiUrl = extra.apiUrl.trim().replace(/\/+$/, '');
  const environment = extra.appEnvironment.trim();
  const category = classifyApiTarget(apiUrl, environment);

  if (environment === 'staging' && category !== 'staging') {
    throw new Error('Staging API target must use a public HTTPS host.');
  }
  if (category === 'invalid/missing') {
    throw new Error('API runtime configuration is unavailable.');
  }

  return { apiUrl, category, environment };
}
