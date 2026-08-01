import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { createConfiguredFirebaseAdminAuthAdapter } from '../auth/firebase-admin.js';
import { createFirebaseRevocationStatusService } from '../auth/firebase-revocation-status.js';
import { createFirebaseTokenVerifier } from '../auth/firebase-token-verifier.js';
import {
  AuthBoundaryError,
  type FirebaseRevocationStatusService,
  type FirebaseTokenVerifier,
  type VerifiedFirebaseIdentity,
} from '../auth/types.js';
import { firebaseVerificationFailureCategory } from '../auth/firebase-token-verifier.js';
import { emitServerDiagnostic } from '../lib/diagnostics.js';
import {
  createPrismaFirebaseUserRepository,
  synchronizeFirebaseUser,
} from '../auth/synchronize-firebase-user.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { isRecentlyAuthenticated } from '../auth/recent-auth.js';

export interface FirebaseAuthMiddlewareDependencies {
  verifier: FirebaseTokenVerifier;
  revocation: FirebaseRevocationStatusService;
  synchronizeUser: (
    identity: VerifiedFirebaseIdentity,
  ) => Promise<{ id: string }>;
}

export interface FirebaseDeletionAuthMiddlewareDependencies {
  verifier: FirebaseTokenVerifier;
  revocation: FirebaseRevocationStatusService;
}

function authorizationError(
  code: 'AUTHORIZATION_REQUIRED' | 'INVALID_AUTHORIZATION',
): AppError {
  return new AppError(401, code, 'Authentication could not be verified.');
}

function bearerToken(authorization: string | undefined): string {
  if (authorization === undefined || authorization === '') {
    throw authorizationError('AUTHORIZATION_REQUIRED');
  }

  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  const token = match?.[1];
  if (token === undefined) throw authorizationError('INVALID_AUTHORIZATION');
  return token;
}

function requiresEmailVerification(
  identity: VerifiedFirebaseIdentity,
): boolean {
  return identity.providerIds.includes('password') && !identity.emailVerified;
}

export function identitySyncFailureCategory(
  error: unknown,
):
  | 'database_unavailable'
  | 'database_authentication_failed'
  | 'database_schema_unavailable'
  | 'database_initialization_failed'
  | 'unknown_identity_sync_failure' {
  if (typeof error !== 'object' || error === null) {
    return 'unknown_identity_sync_failure';
  }

  const code = (error as { code?: unknown }).code;
  if (code === 'P1001') return 'database_unavailable';
  if (code === 'P1000') return 'database_authentication_failed';
  if (code === 'P2021') return 'database_schema_unavailable';
  if (
    (error as { name?: unknown }).name === 'PrismaClientInitializationError'
  ) {
    return 'database_initialization_failed';
  }

  return 'unknown_identity_sync_failure';
}

function authAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (identitySyncFailureCategory(error) === 'database_initialization_failed') {
    return new AppError(
      503,
      'INTERNAL_SERVER_ERROR',
      'The request could not be completed.',
    );
  }
  if (error instanceof AuthBoundaryError) {
    const status =
      error.code === 'EMAIL_VERIFICATION_REQUIRED'
        ? 403
        : error.code === 'ACCOUNT_DELETION_IN_PROGRESS'
          ? 409
          : error.code === 'AUTH_CONFIGURATION_ERROR'
            ? 500
            : 401;
    return new AppError(
      status,
      error.code,
      'Authentication could not be verified.',
    );
  }
  return new AppError(
    401,
    'INVALID_AUTH_TOKEN',
    'Authentication could not be verified.',
  );
}

function runtimeDependencies(): FirebaseAuthMiddlewareDependencies {
  const adapter = createConfiguredFirebaseAdminAuthAdapter();
  const repository = createPrismaFirebaseUserRepository(prisma);
  return {
    verifier: createFirebaseTokenVerifier(adapter),
    revocation: createFirebaseRevocationStatusService(adapter),
    synchronizeUser: (identity) =>
      synchronizeFirebaseUser(repository, identity),
  };
}

function deletionRuntimeDependencies(): FirebaseDeletionAuthMiddlewareDependencies {
  const adapter = createConfiguredFirebaseAdminAuthAdapter();
  return {
    verifier: createFirebaseTokenVerifier(adapter),
    revocation: createFirebaseRevocationStatusService(adapter),
  };
}

export function createFirebaseDeletionAuthMiddleware(
  dependencies?: FirebaseDeletionAuthMiddlewareDependencies,
): RequestHandler {
  let resolvedDependencies = dependencies;
  const getDependencies = (): FirebaseDeletionAuthMiddlewareDependencies =>
    (resolvedDependencies ??= deletionRuntimeDependencies());

  return async (request, response, next): Promise<void> => {
    try {
      const authorization = request.header('authorization')?.trim();
      const token = bearerToken(authorization);
      const activeDependencies = getDependencies();
      const identity = await activeDependencies.verifier.verifyIdToken(token);
      await activeDependencies.revocation.assertActive(identity);
      if (!isRecentlyAuthenticated(identity)) {
        next(
          new AppError(
            401,
            'RECENT_AUTH_REQUIRED',
            'Please verify your identity again before continuing.',
          ),
        );
        return;
      }
      response.locals.firebaseIdentity = identity;
      next();
    } catch (error) {
      next(authAppError(error));
    }
  };
}

export function createFirebaseAuthMiddleware(
  dependencies?: FirebaseAuthMiddlewareDependencies,
): RequestHandler {
  let resolvedDependencies = dependencies;
  const getDependencies = (): FirebaseAuthMiddlewareDependencies => {
    resolvedDependencies ??= runtimeDependencies();
    return resolvedDependencies;
  };

  return async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    let verificationStarted = false;
    let verificationSucceeded = false;
    let revocationCheckStarted = false;
    let revocationCheckSucceeded = false;
    let identitySyncStarted = false;
    let identitySyncSucceeded = false;
    try {
      const authorization = request.header('authorization')?.trim();
      emitServerDiagnostic('authorization_header_present', {
        operation:
          authorization === undefined || authorization === '' ? 'no' : 'yes',
      });
      const token = bearerToken(authorization);
      emitServerDiagnostic('bearer_token_shape_valid');
      const activeDependencies = getDependencies();
      verificationStarted = true;
      emitServerDiagnostic('firebase_verification_started');
      const identity = await activeDependencies.verifier.verifyIdToken(token);
      verificationSucceeded = true;
      emitServerDiagnostic('firebase_verification_succeeded');
      revocationCheckStarted = true;
      emitServerDiagnostic('firebase_revocation_check_started');
      await activeDependencies.revocation.assertActive(identity);
      revocationCheckSucceeded = true;
      emitServerDiagnostic('firebase_revocation_check_succeeded');
      if (requiresEmailVerification(identity)) {
        throw new AppError(
          403,
          'EMAIL_VERIFICATION_REQUIRED',
          'Email verification is required.',
        );
      }

      identitySyncStarted = true;
      emitServerDiagnostic('application_identity_sync_started');
      const user = await activeDependencies.synchronizeUser(identity);
      identitySyncSucceeded = true;
      emitServerDiagnostic('application_identity_sync_succeeded');
      response.locals.userId = user.id;
      next();
    } catch (error) {
      if (verificationStarted && !verificationSucceeded) {
        emitServerDiagnostic('firebase_verification_failed', {
          errorCategory: firebaseVerificationFailureCategory(error),
        });
      } else if (revocationCheckStarted && !revocationCheckSucceeded) {
        emitServerDiagnostic('firebase_revocation_check_failed', {
          errorCategory: firebaseVerificationFailureCategory(error),
        });
      } else if (identitySyncStarted && !identitySyncSucceeded) {
        emitServerDiagnostic('application_identity_sync_failed', {
          errorCategory: identitySyncFailureCategory(error),
        });
      }
      next(authAppError(error));
    }
  };
}
