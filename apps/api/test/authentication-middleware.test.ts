import { readFileSync } from 'node:fs';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  createFirebaseAuthMiddleware,
  type FirebaseAuthMiddlewareDependencies,
} from '../src/middleware/firebase-auth.js';
import { AuthBoundaryError } from '../src/auth/types.js';
import type {
  FirebaseRevocationStatusService,
  FirebaseTokenVerifier,
  VerifiedFirebaseIdentity,
} from '../src/auth/types.js';
import { createApp } from '../src/app.js';

const verifiedIdentity: VerifiedFirebaseIdentity = {
  uid: 'firebase-user-1',
  email: 'user@example.com',
  emailVerified: true,
  displayName: null,
  photoUrl: null,
  providerIds: ['google.com'],
  signInProvider: 'google.com',
  issuedAt: 200,
  authenticatedAt: 100,
};

function requestWithAuthorization(authorization: string | undefined): Request {
  return {
    header: vi.fn().mockReturnValue(authorization),
  } as unknown as Request;
}

function dependenciesWith(
  overrides: Partial<FirebaseAuthMiddlewareDependencies> = {},
): FirebaseAuthMiddlewareDependencies {
  const verifier: FirebaseTokenVerifier = {
    verifyIdToken: vi.fn().mockResolvedValue(verifiedIdentity),
  };
  const revocation: FirebaseRevocationStatusService = {
    assertActive: vi.fn().mockResolvedValue(undefined),
  };
  return {
    verifier,
    revocation,
    synchronizeUser: vi.fn().mockResolvedValue({ id: 'application-user-1' }),
    ...overrides,
  };
}

function response(): Response {
  return { locals: {} } as unknown as Response;
}

type MockNextFunction = NextFunction & ReturnType<typeof vi.fn>;

function nextFunction(): MockNextFunction {
  return vi.fn() as unknown as MockNextFunction;
}

describe('Firebase authentication middleware', () => {
  it('is the application protected-route boundary instead of runtime mock auth', () => {
    const appSource = readFileSync(
      new URL('../src/app.ts', import.meta.url),
      'utf8',
    );

    expect(appSource).toContain('createFirebaseAuthMiddleware');
    expect(appSource).not.toContain('mockAuth');
  });

  it('allows the test harness to inject deterministic auth explicitly', async () => {
    const injectedAuth = vi.fn((_request, _response, nextFunction) => {
      nextFunction();
    });
    const testApp = createApp(injectedAuth);

    await request(testApp).get('/api/v1/test-only-missing-route').expect(404);

    expect(injectedAuth).toHaveBeenCalledTimes(1);
  });

  it('rejects a missing Authorization header before verification', async () => {
    const dependencies = dependenciesWith();
    const next = nextFunction();

    await createFirebaseAuthMiddleware(dependencies)(
      requestWithAuthorization(undefined),
      response(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTHORIZATION_REQUIRED',
        status: 401,
      }),
    );
    expect(dependencies.verifier.verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects a missing header before resolving server-only Firebase configuration', async () => {
    const next = nextFunction();

    await createFirebaseAuthMiddleware()(
      requestWithAuthorization(undefined),
      response(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUTHORIZATION_REQUIRED' }),
    );
  });

  it.each([
    'Basic credential',
    'Bearer',
    'Bearer token extra',
    'Bearer token another-token',
  ])('rejects malformed Bearer header %s', async (authorization) => {
    const dependencies = dependenciesWith();
    const next = nextFunction();

    await createFirebaseAuthMiddleware(dependencies)(
      requestWithAuthorization(authorization),
      response(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_AUTHORIZATION', status: 401 }),
    );
    expect(dependencies.verifier.verifyIdToken).not.toHaveBeenCalled();
  });

  it('verifies, checks strict status, synchronizes, and stores only the application UUID', async () => {
    const dependencies = dependenciesWith();
    const next = nextFunction();
    const currentResponse = response();

    await createFirebaseAuthMiddleware(dependencies)(
      requestWithAuthorization('Bearer firebase-token'),
      currentResponse,
      next,
    );

    expect(dependencies.verifier.verifyIdToken).toHaveBeenCalledWith(
      'firebase-token',
    );
    expect(dependencies.revocation.assertActive).toHaveBeenCalledWith(
      verifiedIdentity,
    );
    expect(dependencies.synchronizeUser).toHaveBeenCalledWith(verifiedIdentity);
    expect(currentResponse.locals).toEqual({ userId: 'application-user-1' });
    expect(next).toHaveBeenCalledWith();
  });

  it('blocks an unverified password account before synchronization', async () => {
    const dependencies = dependenciesWith({
      verifier: {
        verifyIdToken: vi.fn().mockResolvedValue({
          ...verifiedIdentity,
          emailVerified: false,
          providerIds: ['password'],
          signInProvider: 'password',
        }),
      },
    });
    const next = nextFunction();

    await createFirebaseAuthMiddleware(dependencies)(
      requestWithAuthorization('Bearer firebase-token'),
      response(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        status: 403,
      }),
    );
    expect(dependencies.synchronizeUser).not.toHaveBeenCalled();
  });

  it('does not synchronize after strict status failure', async () => {
    const dependencies = dependenciesWith({
      revocation: {
        assertActive: vi
          .fn()
          .mockRejectedValue(new AuthBoundaryError('AUTH_TOKEN_REVOKED')),
      },
    });
    const next = nextFunction();

    await createFirebaseAuthMiddleware(dependencies)(
      requestWithAuthorization('Bearer firebase-token'),
      response(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUTH_TOKEN_REVOKED', status: 401 }),
    );
    expect(dependencies.synchronizeUser).not.toHaveBeenCalled();
  });

  it('maps verifier failures to stable safe API errors', async () => {
    const dependencies = dependenciesWith({
      verifier: {
        verifyIdToken: vi
          .fn()
          .mockRejectedValue(new AuthBoundaryError('AUTH_TOKEN_EXPIRED')),
      },
    });
    const next = nextFunction();

    await createFirebaseAuthMiddleware(dependencies)(
      requestWithAuthorization('Bearer firebase-token'),
      response(),
      next,
    );

    const error = next.mock.calls[0]?.[0];
    expect(error).toMatchObject({ code: 'AUTH_TOKEN_EXPIRED', status: 401 });
    expect(error).not.toHaveProperty('details.providerMessage');
  });

  it('returns a safe availability response when application identity synchronization cannot initialize the database', async () => {
    const dependencies = dependenciesWith({
      synchronizeUser: vi.fn().mockRejectedValue(
        Object.assign(new Error(), {
          name: 'PrismaClientInitializationError',
        }),
      ),
    });
    const next = nextFunction();

    await createFirebaseAuthMiddleware(dependencies)(
      requestWithAuthorization('Bearer firebase-token'),
      response(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_SERVER_ERROR', status: 503 }),
    );
  });
});
