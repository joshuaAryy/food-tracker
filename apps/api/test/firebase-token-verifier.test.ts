import { describe, expect, it, vi } from 'vitest';
import {
  AuthBoundaryError,
  createFirebaseTokenVerifier,
  type FirebaseAdminAuthAdapter,
  type VerifiedFirebaseIdentity,
} from '../src/auth/firebase-token-verifier.js';

const identity: VerifiedFirebaseIdentity = {
  uid: 'firebase-user-1',
  email: 'user@example.com',
  emailVerified: true,
  displayName: 'User',
  photoUrl: null,
  providerIds: ['password'],
  signInProvider: 'password',
  issuedAt: 1_700_000_100,
  authenticatedAt: 1_700_000_000,
};

function adapterWith(
  verifyIdToken: FirebaseAdminAuthAdapter['verifyIdToken'],
): FirebaseAdminAuthAdapter {
  return {
    verifyIdToken,
    getUser: vi.fn(),
  };
}

describe('Firebase token verifier', () => {
  it('delegates ordinary token verification and returns normalized identity claims', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue(identity);
    const verifier = createFirebaseTokenVerifier(adapterWith(verifyIdToken));

    await expect(verifier.verifyIdToken('firebase-token')).resolves.toEqual(
      identity,
    );
    expect(verifyIdToken).toHaveBeenCalledWith('firebase-token');
  });

  it('rejects an empty bearer token without calling Firebase', async () => {
    const verifyIdToken = vi.fn();
    const verifier = createFirebaseTokenVerifier(adapterWith(verifyIdToken));

    await expect(verifier.verifyIdToken('   ')).rejects.toMatchObject({
      code: 'INVALID_AUTH_TOKEN',
    });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it.each([
    ['auth/id-token-expired', 'AUTH_TOKEN_EXPIRED'],
    ['auth/id-token-revoked', 'AUTH_TOKEN_REVOKED'],
    ['auth/argument-error', 'INVALID_AUTH_TOKEN'],
    ['auth/invalid-credential', 'INVALID_AUTH_TOKEN'],
  ] as const)('maps Firebase failure %s to %s', async (providerCode, code) => {
    const verifyIdToken = vi.fn().mockRejectedValue(
      Object.assign(new Error('private provider detail'), {
        code: providerCode,
      }),
    );
    const verifier = createFirebaseTokenVerifier(adapterWith(verifyIdToken));

    await expect(
      verifier.verifyIdToken('firebase-token'),
    ).rejects.toMatchObject({ code });
  });

  it('does not retain a provider exception as the public error message', async () => {
    const verifyIdToken = vi.fn().mockRejectedValue(
      Object.assign(new Error('https://private.firebase.example/provider'), {
        code: 'auth/internal-error',
      }),
    );
    const verifier = createFirebaseTokenVerifier(adapterWith(verifyIdToken));

    await expect(verifier.verifyIdToken('firebase-token')).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof AuthBoundaryError &&
        error.code === 'INVALID_AUTH_TOKEN' &&
        error.message === 'Firebase authentication failed.',
    );
  });
});
