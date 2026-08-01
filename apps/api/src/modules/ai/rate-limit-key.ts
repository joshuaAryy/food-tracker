import { createHmac } from 'node:crypto';

const DEVELOPMENT_RATE_LIMIT_SECRET = 'food-tracker-development-rate-limit-key';

function normalizedNetworkIdentifier(value: unknown): string {
  if (typeof value !== 'string') return 'unknown';
  const trimmed = value.trim();
  const containsControlCharacter = [...trimmed].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (
    trimmed.length === 0 ||
    trimmed.length > 128 ||
    containsControlCharacter
  ) {
    return 'unknown';
  }
  return trimmed;
}

export function createOpaqueRateLimitKey(input: {
  userId: string;
  networkIdentifier: unknown;
  secret: string;
  scope?: string;
}): string {
  const scope = input.scope?.trim() || 'ai';
  const material = [
    scope,
    input.userId,
    normalizedNetworkIdentifier(input.networkIdentifier),
  ].join('\u0000');
  return createHmac('sha256', input.secret).update(material).digest('hex');
}

export function rateLimitKeySecret(
  environment: Record<string, string | undefined> = process.env,
): string {
  const configured = environment.RATE_LIMIT_KEY_SECRET?.trim();
  if (configured !== undefined && configured.length > 0) return configured;

  const appEnvironment = environment.APP_ENV?.trim().toLowerCase();
  if (appEnvironment === 'staging' || appEnvironment === 'production') {
    throw new Error('RATE_LIMIT_KEY_SECRET is required outside development.');
  }

  return DEVELOPMENT_RATE_LIMIT_SECRET;
}

export function createRequestRateLimitKey(input: {
  userId: string;
  networkIdentifier: unknown;
  scope?: string;
  environment?: Record<string, string | undefined>;
}): string {
  return createOpaqueRateLimitKey({
    userId: input.userId,
    networkIdentifier: input.networkIdentifier,
    secret: rateLimitKeySecret(input.environment),
    ...(input.scope === undefined ? {} : { scope: input.scope }),
  });
}
