import {
  AuthBoundaryError,
  type FirebaseAdminAuthAdapter,
  type FirebaseTokenVerifier,
} from './types.js';

export { AuthBoundaryError } from './types.js';
export type {
  FirebaseAdminAuthAdapter,
  FirebaseTokenVerifier,
  VerifiedFirebaseIdentity,
} from './types.js';

function providerErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function normalizedFailure(error: unknown): AuthBoundaryError {
  switch (providerErrorCode(error)) {
    case 'auth/id-token-expired':
      return new AuthBoundaryError('AUTH_TOKEN_EXPIRED', { cause: error });
    case 'auth/id-token-revoked':
    case 'auth/user-disabled':
    case 'auth/user-not-found':
      return new AuthBoundaryError('AUTH_TOKEN_REVOKED', { cause: error });
    case 'auth/configuration-error':
      return new AuthBoundaryError('AUTH_CONFIGURATION_ERROR', {
        cause: error,
      });
    default:
      return new AuthBoundaryError('INVALID_AUTH_TOKEN', { cause: error });
  }
}

export function createFirebaseTokenVerifier(
  adapter: FirebaseAdminAuthAdapter,
): FirebaseTokenVerifier {
  return {
    async verifyIdToken(token) {
      if (token.trim() === '') {
        throw new AuthBoundaryError('INVALID_AUTH_TOKEN');
      }
      try {
        return await adapter.verifyIdToken(token);
      } catch (error) {
        if (error instanceof AuthBoundaryError) throw error;
        throw normalizedFailure(error);
      }
    },
  };
}
