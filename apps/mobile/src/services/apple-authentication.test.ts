import { describe, expect, it, vi } from 'vitest';
import {
  signInWithApple,
  type AppleAuthenticationAdapter,
} from './apple-authentication';
import { AuthServiceError } from './auth-errors';
import { PendingProviderCredentialStore } from './pending-provider-credential';
import type { FirebaseAuthUser } from './auth-service';

function user(overrides: Partial<FirebaseAuthUser> = {}): FirebaseAuthUser {
  return {
    uid: 'firebase-user-1',
    email: null,
    emailVerified: true,
    displayName: null,
    photoUrl: null,
    providerIds: ['apple.com'],
    updateProfile: vi.fn().mockResolvedValue(undefined),
    sendEmailVerification: vi.fn(),
    reload: vi.fn(),
    getIdToken: vi.fn(),
    ...overrides,
  };
}

describe('Apple authentication service', () => {
  it('hashes the nonce for Apple and passes the raw nonce to Firebase', async () => {
    const authenticatedUser = user();
    const authService = {
      signInWithCredential: vi.fn().mockResolvedValue(authenticatedUser),
    };
    const adapter: AppleAuthenticationAdapter = {
      randomBytes: vi.fn().mockResolvedValue(new Uint8Array(32).fill(4)),
      digest: vi.fn().mockResolvedValue('hashed-nonce'),
      signIn: vi.fn().mockResolvedValue({
        identityToken: 'apple-identity-token',
        email: 'relay@example.com',
        fullName: { givenName: 'Apple', familyName: 'User' },
      }),
      createFirebaseCredential: vi.fn().mockReturnValue('firebase-credential'),
    };

    await expect(signInWithApple(authService, adapter)).resolves.toBe(
      authenticatedUser,
    );
    expect(adapter.signIn).toHaveBeenCalledWith({ nonce: 'hashed-nonce' });
    expect(adapter.createFirebaseCredential).toHaveBeenCalledWith(
      'apple-identity-token',
      '0404040404040404040404040404040404040404040404040404040404040404',
    );
    expect(authService.signInWithCredential).toHaveBeenCalledWith(
      'firebase-credential',
    );
    expect(authenticatedUser.updateProfile).toHaveBeenCalledWith({
      displayName: 'Apple User',
    });
  });

  it('does not overwrite an existing user-owned display name', async () => {
    const authenticatedUser = user({ displayName: 'Existing Name' });
    const authService = {
      signInWithCredential: vi.fn().mockResolvedValue(authenticatedUser),
    };
    const adapter = adapterWith({
      signIn: vi.fn().mockResolvedValue({
        identityToken: 'apple-token',
        email: null,
        fullName: { givenName: 'Provider', familyName: 'Name' },
      }),
    });

    await signInWithApple(authService, adapter);

    expect(authenticatedUser.updateProfile).not.toHaveBeenCalled();
  });

  it('normalizes cancellation and missing identity tokens safely', async () => {
    const authService = { signInWithCredential: vi.fn() };
    const cancelled = adapterWith({
      signIn: vi.fn().mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' }),
    });
    await expect(signInWithApple(authService, cancelled)).rejects.toMatchObject(
      {
        code: 'providerCancelled',
      },
    );

    const missingToken = adapterWith({
      signIn: vi.fn().mockResolvedValue({
        identityToken: null,
        email: null,
        fullName: null,
      }),
    });
    await expect(signInWithApple(authService, missingToken)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof AuthServiceError && error.code === 'unknown',
    );
  });

  it('retains only the active Apple credential when Firebase reports a provider conflict', async () => {
    const pending = new PendingProviderCredentialStore<unknown>();
    const authService = {
      signInWithCredential: vi
        .fn()
        .mockRejectedValue(new AuthServiceError('providerConflict')),
    };
    const adapter = adapterWith({
      createFirebaseCredential: vi.fn().mockReturnValue('pending-credential'),
    });

    await expect(
      signInWithApple(authService, adapter, pending),
    ).rejects.toMatchObject({
      code: 'providerConflict',
    });
    expect(pending.get()).toMatchObject({
      provider: 'apple',
      credential: 'pending-credential',
    });
  });
});

function adapterWith(
  overrides: Partial<AppleAuthenticationAdapter> = {},
): AppleAuthenticationAdapter {
  return {
    randomBytes: vi.fn().mockResolvedValue(new Uint8Array(32)),
    digest: vi.fn().mockResolvedValue('hash'),
    signIn: vi.fn().mockResolvedValue({
      identityToken: 'token',
      email: null,
      fullName: null,
    }),
    createFirebaseCredential: vi.fn().mockReturnValue('credential'),
    ...overrides,
  };
}
