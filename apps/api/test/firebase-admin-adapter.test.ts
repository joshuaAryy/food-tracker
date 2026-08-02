import { describe, expect, it, vi } from 'vitest';
import { createFirebaseAdminAuthAdapter } from '../src/auth/firebase-admin-adapter.js';
import { createFirebaseAdminAuth } from '../src/auth/firebase-admin.js';
import { AuthBoundaryError } from '../src/auth/types.js';

describe('Firebase Admin adapter', () => {
  it('uses ordinary modular token verification and normalizes provider claims', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({
      uid: 'firebase-user-1',
      email: 'user@example.com',
      email_verified: true,
      picture: 'https://example.com/profile.png',
      iat: 200,
      auth_time: 100,
      firebase: {
        identities: { password: ['firebase-user-1'] },
        sign_in_provider: 'password',
      },
      name: 'User',
    });
    const adapter = createFirebaseAdminAuthAdapter({
      verifyIdToken,
      getUser: vi.fn(),
      deleteUser: vi.fn(),
    });

    await expect(adapter.verifyIdToken('token')).resolves.toEqual({
      uid: 'firebase-user-1',
      email: 'user@example.com',
      emailVerified: true,
      displayName: 'User',
      photoUrl: 'https://example.com/profile.png',
      providerIds: ['password'],
      signInProvider: 'password',
      issuedAt: 200,
      authenticatedAt: 100,
    });
    expect(verifyIdToken).toHaveBeenCalledWith('token', false);
  });

  it('normalizes Firebase user status without returning provider records', async () => {
    const getUser = vi.fn().mockResolvedValue({
      uid: 'firebase-user-1',
      disabled: false,
      tokensValidAfterTime: '2026-07-26T00:00:00.000Z',
      email: 'private@example.com',
      passwordHash: 'private-hash',
    });
    const adapter = createFirebaseAdminAuthAdapter({
      verifyIdToken: vi.fn(),
      getUser,
      deleteUser: vi.fn(),
    });

    await expect(adapter.getUser('firebase-user-1')).resolves.toEqual({
      uid: 'firebase-user-1',
      disabled: false,
      tokensValidAfterTime: '2026-07-26T00:00:00.000Z',
    });
  });

  it('maps Admin failures to safe boundary errors', async () => {
    const providerError = Object.assign(
      new Error('private Firebase response body'),
      { code: 'auth/user-not-found' },
    );
    const adapter = createFirebaseAdminAuthAdapter({
      verifyIdToken: vi.fn().mockRejectedValue(providerError),
      getUser: vi.fn().mockRejectedValue(providerError),
      deleteUser: vi.fn(),
    });

    await expect(adapter.verifyIdToken('token')).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof AuthBoundaryError &&
        error.code === 'INVALID_AUTH_TOKEN' &&
        error.message === 'Firebase authentication failed.',
    );
    await expect(adapter.getUser('firebase-user-1')).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof AuthBoundaryError &&
        error.code === 'AUTH_TOKEN_REVOKED' &&
        error.message === 'Firebase authentication failed.',
    );
  });

  it('fails closed when server-only Firebase configuration is incomplete', () => {
    expect(() => createFirebaseAdminAuth({})).toThrowError(
      expect.objectContaining({ code: 'AUTH_CONFIGURATION_ERROR' }),
    );
  });
});
