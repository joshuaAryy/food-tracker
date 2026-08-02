import {
  AuthBoundaryError,
  type FirebaseAdminAuthAdapter,
  type FirebaseTokenVerifier,
  type FirebaseVerificationFailureCategory,
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
      return new AuthBoundaryError('AUTH_TOKEN_EXPIRED', {
        cause: error,
        diagnosticCategory: 'expired_token',
      });
    case 'auth/id-token-revoked':
      return new AuthBoundaryError('AUTH_TOKEN_REVOKED', {
        cause: error,
        diagnosticCategory: 'revoked_token',
      });
    case 'auth/user-disabled':
      return new AuthBoundaryError('AUTH_TOKEN_REVOKED', {
        cause: error,
        diagnosticCategory: 'disabled_user',
      });
    case 'auth/user-not-found':
      return new AuthBoundaryError('AUTH_TOKEN_REVOKED', {
        cause: error,
        diagnosticCategory: 'revoked_token',
      });
    case 'auth/configuration-error':
    case 'auth/invalid-config':
      return new AuthBoundaryError('AUTH_CONFIGURATION_ERROR', {
        cause: error,
        diagnosticCategory: 'admin_configuration_error',
      });
    case 'auth/invalid-credential':
      return new AuthBoundaryError('INVALID_AUTH_TOKEN', {
        cause: error,
        diagnosticCategory: 'admin_configuration_error',
      });
    case 'auth/invalid-id-token':
    case 'auth/argument-error':
      return new AuthBoundaryError('INVALID_AUTH_TOKEN', {
        cause: error,
        diagnosticCategory: 'malformed_token',
      });
    case 'auth/invalid-signature':
      return new AuthBoundaryError('INVALID_AUTH_TOKEN', {
        cause: error,
        diagnosticCategory: 'invalid_signature',
      });
    case 'auth/invalid-audience':
      return new AuthBoundaryError('INVALID_AUTH_TOKEN', {
        cause: error,
        diagnosticCategory: 'invalid_audience',
      });
    case 'auth/invalid-issuer':
      return new AuthBoundaryError('INVALID_AUTH_TOKEN', {
        cause: error,
        diagnosticCategory: 'invalid_issuer',
      });
    case 'auth/project-mismatch':
      return new AuthBoundaryError('INVALID_AUTH_TOKEN', {
        cause: error,
        diagnosticCategory: 'project_mismatch',
      });
    default:
      return new AuthBoundaryError('INVALID_AUTH_TOKEN', {
        cause: error,
        diagnosticCategory: 'unknown_verification_failure',
      });
  }
}

export function firebaseVerificationFailureCategory(
  error: unknown,
): FirebaseVerificationFailureCategory {
  if (error instanceof AuthBoundaryError) {
    if (error.diagnosticCategory !== undefined) return error.diagnosticCategory;
    switch (error.code) {
      case 'AUTH_TOKEN_EXPIRED':
        return 'expired_token';
      case 'AUTH_TOKEN_REVOKED':
        return 'revoked_token';
      case 'AUTH_CONFIGURATION_ERROR':
        return 'admin_configuration_error';
      default:
        return 'unknown_verification_failure';
    }
  }
  return 'unknown_verification_failure';
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
