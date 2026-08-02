export const NORMALIZED_AUTH_ERROR_CODES = [
  'invalidCredentials',
  'emailAlreadyInUse',
  'weakPassword',
  'verificationRequired',
  'tooManyRequests',
  'networkUnavailable',
  'providerCancelled',
  'providerConflict',
  'credentialExpired',
  'sessionExpired',
  'configurationError',
  'unknown',
] as const;

export type NormalizedAuthErrorCode =
  (typeof NORMALIZED_AUTH_ERROR_CODES)[number];

export class AuthServiceError extends Error {
  constructor(public readonly code: NormalizedAuthErrorCode) {
    super('Authentication failed.');
    this.name = 'AuthServiceError';
  }
}

function providerErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export function normalizeAuthError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;

  switch (providerErrorCode(error)) {
    case 'auth/invalid-credential':
    case 'auth/invalid-email':
    case 'auth/user-disabled':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return new AuthServiceError('invalidCredentials');
    case 'auth/email-already-in-use':
      return new AuthServiceError('emailAlreadyInUse');
    case 'auth/weak-password':
      return new AuthServiceError('weakPassword');
    case 'auth/too-many-requests':
      return new AuthServiceError('tooManyRequests');
    case 'auth/network-request-failed':
      return new AuthServiceError('networkUnavailable');
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return new AuthServiceError('providerCancelled');
    case 'auth/account-exists-with-different-credential':
    case 'auth/credential-already-in-use':
    case 'auth/provider-already-linked':
      return new AuthServiceError('providerConflict');
    case 'auth/requires-recent-login':
    case 'auth/credential-too-old-login-again':
      return new AuthServiceError('credentialExpired');
    case 'auth/id-token-expired':
    case 'auth/user-token-expired':
      return new AuthServiceError('sessionExpired');
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return new AuthServiceError('configurationError');
    default:
      return new AuthServiceError('unknown');
  }
}

export function validatePassword(
  password: string,
): { ok: true } | { ok: false; code: 'weakPassword' } {
  return password.length >= 8
    ? { ok: true }
    : { ok: false, code: 'weakPassword' };
}
