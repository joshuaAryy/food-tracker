import { describe, expect, it, vi } from 'vitest';
import {
  GoogleAuthenticationService,
  type GoogleAuthenticationAdapter,
} from './google-authentication';
import { AuthServiceError } from './auth-errors';
import { PendingProviderCredentialStore } from './pending-provider-credential';
import type { FirebaseAuthUser } from './auth-service';

function user(): FirebaseAuthUser {
  return {
    uid: 'firebase-user-1',
    email: 'user@example.com',
    emailVerified: true,
    displayName: 'User',
    photoUrl: null,
    providerIds: ['google.com'],
    updateProfile: vi.fn(),
    sendEmailVerification: vi.fn(),
    reload: vi.fn(),
    getIdToken: vi.fn(),
  };
}

function adapterWith(
  overrides: Partial<GoogleAuthenticationAdapter> = {},
): GoogleAuthenticationAdapter {
  return {
    configure: vi.fn(),
    signIn: vi
      .fn()
      .mockResolvedValue({ type: 'success', idToken: 'google-token' }),
    createFirebaseCredential: vi.fn().mockReturnValue('firebase-credential'),
    ...overrides,
  };
}

describe('Google authentication service', () => {
  it('configures once, obtains an ID token, and exchanges it with Firebase', async () => {
    const adapter = adapterWith();
    const authService = {
      signInWithCredential: vi.fn().mockResolvedValue(user()),
    };
    const service = new GoogleAuthenticationService(authService, adapter);

    await service.signIn('google-web-client-id');
    await service.signIn('google-web-client-id');

    expect(adapter.configure).toHaveBeenCalledTimes(1);
    expect(adapter.configure).toHaveBeenCalledWith({
      webClientId: 'google-web-client-id',
    });
    expect(adapter.createFirebaseCredential).toHaveBeenCalledWith(
      'google-token',
    );
    expect(authService.signInWithCredential).toHaveBeenCalledTimes(2);
  });

  it('rejects missing configuration and missing Google ID tokens', async () => {
    const adapter = adapterWith();
    const authService = { signInWithCredential: vi.fn() };
    const service = new GoogleAuthenticationService(authService, adapter);

    await expect(service.signIn('')).rejects.toMatchObject({
      code: 'configurationError',
    });
    const missingTokenService = new GoogleAuthenticationService(
      authService,
      adapterWith({
        signIn: vi.fn().mockResolvedValue({ type: 'success', idToken: null }),
      }),
    );
    await expect(missingTokenService.signIn('client-id')).rejects.toMatchObject(
      {
        code: 'unknown',
      },
    );
  });

  it('normalizes cancellation and native Google failures', async () => {
    const authService = { signInWithCredential: vi.fn() };
    const cancelled = new GoogleAuthenticationService(
      authService,
      adapterWith({ signIn: vi.fn().mockResolvedValue({ type: 'cancelled' }) }),
    );
    await expect(cancelled.signIn('client-id')).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof AuthServiceError && error.code === 'providerCancelled',
    );

    const unavailable = new GoogleAuthenticationService(
      authService,
      adapterWith({
        signIn: vi
          .fn()
          .mockRejectedValue({ code: 'PLAY_SERVICES_NOT_AVAILABLE' }),
      }),
    );
    await expect(unavailable.signIn('client-id')).rejects.toMatchObject({
      code: 'networkUnavailable',
    });
  });

  it('retains only the active Google credential when Firebase reports a provider conflict', async () => {
    const pending = new PendingProviderCredentialStore<unknown>();
    const adapter = adapterWith({
      createFirebaseCredential: vi.fn().mockReturnValue('pending-credential'),
    });
    const authService = {
      signInWithCredential: vi
        .fn()
        .mockRejectedValue(new AuthServiceError('providerConflict')),
    };
    const service = new GoogleAuthenticationService(
      authService,
      adapter,
      pending,
    );

    await expect(service.signIn('client-id')).rejects.toMatchObject({
      code: 'providerConflict',
    });
    expect(pending.get()).toMatchObject({
      provider: 'google',
      credential: 'pending-credential',
    });
  });
});
