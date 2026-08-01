import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  createFirebaseDeletionAuthMiddleware,
  type FirebaseDeletionAuthMiddlewareDependencies,
} from '../src/middleware/firebase-auth.js';
import type {
  FirebaseRevocationStatusService,
  FirebaseTokenVerifier,
  VerifiedFirebaseIdentity,
} from '../src/auth/types.js';

function identity(
  authenticatedAt = Math.floor(Date.now() / 1000),
): VerifiedFirebaseIdentity {
  return {
    uid: 'firebase-user-1',
    email: null,
    emailVerified: true,
    displayName: null,
    photoUrl: null,
    providerIds: ['password'],
    signInProvider: 'password',
    issuedAt: authenticatedAt,
    authenticatedAt,
  };
}

function dependencies(
  overrides: Partial<FirebaseDeletionAuthMiddlewareDependencies> = {},
): FirebaseDeletionAuthMiddlewareDependencies {
  return {
    verifier: {
      verifyIdToken: vi.fn().mockResolvedValue(identity()),
    } satisfies FirebaseTokenVerifier,
    revocation: {
      assertActive: vi.fn().mockResolvedValue(undefined),
    } satisfies FirebaseRevocationStatusService,
    ...overrides,
  };
}

function request(authorization?: string): Request {
  return {
    header: vi.fn().mockReturnValue(authorization),
  } as unknown as Request;
}

function response(): Response {
  return { locals: {} } as unknown as Response;
}

function next(): NextFunction & ReturnType<typeof vi.fn> {
  return vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
}

describe('deletion authentication boundary', () => {
  it('requires a bearer token without resolving Firebase configuration', async () => {
    const deps = dependencies();
    const callback = next();
    await createFirebaseDeletionAuthMiddleware(deps)(
      request(),
      response(),
      callback,
    );
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUTHORIZATION_REQUIRED', status: 401 }),
    );
    expect(deps.verifier.verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects valid but stale authentication before reaching deletion', async () => {
    const deps = dependencies({
      verifier: {
        verifyIdToken: vi
          .fn()
          .mockResolvedValue(identity(Math.floor(Date.now() / 1000) - 301)),
      },
    });
    const callback = next();
    await createFirebaseDeletionAuthMiddleware(deps)(
      request('Bearer token'),
      response(),
      callback,
    );
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'RECENT_AUTH_REQUIRED', status: 401 }),
    );
  });

  it('passes a recent verified identity without provisioning an application user', async () => {
    const deps = dependencies();
    const currentResponse = response();
    const callback = next();
    await createFirebaseDeletionAuthMiddleware(deps)(
      request('Bearer token'),
      currentResponse,
      callback,
    );
    expect(currentResponse.locals.firebaseIdentity).toEqual(identity());
    expect(currentResponse.locals.userId).toBeUndefined();
    expect(callback).toHaveBeenCalledWith();
  });
});
