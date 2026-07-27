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
import {
  createPrismaFirebaseUserRepository,
  synchronizeFirebaseUser,
} from '../auth/synchronize-firebase-user.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

export interface FirebaseAuthMiddlewareDependencies {
  verifier: FirebaseTokenVerifier;
  revocation: FirebaseRevocationStatusService;
  synchronizeUser: (
    identity: VerifiedFirebaseIdentity,
  ) => Promise<{ id: string }>;
}

function authorizationError(
  code: 'AUTHORIZATION_REQUIRED' | 'INVALID_AUTHORIZATION',
): AppError {
  return new AppError(401, code, 'Authentication could not be verified.');
}

function bearerToken(request: Request): string {
  const authorization = request.header('authorization')?.trim();
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

function authAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof AuthBoundaryError) {
    const status =
      error.code === 'EMAIL_VERIFICATION_REQUIRED'
        ? 403
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
    try {
      const token = bearerToken(request);
      const activeDependencies = getDependencies();
      const identity = await activeDependencies.verifier.verifyIdToken(token);
      await activeDependencies.revocation.assertActive(identity);
      if (requiresEmailVerification(identity)) {
        throw new AppError(
          403,
          'EMAIL_VERIFICATION_REQUIRED',
          'Email verification is required.',
        );
      }

      const user = await activeDependencies.synchronizeUser(identity);
      response.locals.userId = user.id;
      next();
    } catch (error) {
      next(authAppError(error));
    }
  };
}
