import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthenticationService,
  type AuthServiceAdapter,
  type FirebaseAuthUser,
} from './auth-service';
import {
  AuthServiceError,
  normalizeAuthError,
  validatePassword,
} from './auth-errors';

function user(): FirebaseAuthUser {
  return {
    uid: 'firebase-user-1',
    email: 'user@example.com',
    emailVerified: false,
    displayName: null,
    photoUrl: null,
    providerIds: ['password'],
    updateProfile: vi.fn().mockResolvedValue(undefined),
    sendEmailVerification: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
    getIdToken: vi.fn().mockResolvedValue('firebase-id-token'),
  };
}

function adapterWith(
  currentUser: FirebaseAuthUser | null = user(),
): AuthServiceAdapter {
  return {
    currentUser,
    onIdTokenChanged: vi.fn().mockReturnValue(vi.fn()),
    createUserWithEmailAndPassword: vi
      .fn()
      .mockResolvedValue({ user: currentUser }),
    signInWithEmailAndPassword: vi
      .fn()
      .mockResolvedValue({ user: currentUser }),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    signInWithCredential: vi.fn().mockResolvedValue({ user: currentUser }),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

describe('mobile authentication service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['', '1234567'])(
    'rejects passwords shorter than eight characters: %s',
    (password) => {
      expect(validatePassword(password)).toEqual({
        ok: false,
        code: 'weakPassword',
      });
    },
  );

  it.each(['12345678', 'abcdefgh', 'ABCDEFGH', '!@#$%^&*'])(
    'accepts exactly eight characters without composition rules: %s',
    (password) => {
      expect(validatePassword(password)).toEqual({ ok: true });
    },
  );

  it('creates an account, captures the name, and sends verification email', async () => {
    const currentUser = user();
    const adapter = adapterWith(currentUser);
    const service = new AuthenticationService(adapter);

    await expect(
      service.createAccount({
        name: 'New User',
        email: 'new@example.com',
        password: '12345678',
      }),
    ).resolves.toMatchObject({ uid: currentUser.uid });

    expect(adapter.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      'new@example.com',
      '12345678',
    );
    expect(currentUser.updateProfile).toHaveBeenCalledWith({
      displayName: 'New User',
    });
    expect(currentUser.sendEmailVerification).toHaveBeenCalledTimes(1);
  });

  it('normalizes sign-in failures without retaining provider messages', async () => {
    const adapter = adapterWith();
    vi.mocked(adapter.signInWithEmailAndPassword).mockRejectedValue(
      Object.assign(new Error('FIREBASE_PROJECT_ID=secret-project'), {
        code: 'auth/invalid-credential',
      }),
    );
    const service = new AuthenticationService(adapter);

    await expect(
      service.signInWithEmail('user@example.com', 'password123'),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof AuthServiceError &&
        error.code === 'invalidCredentials' &&
        error.message === 'Authentication failed.',
    );
  });

  it('keeps password reset enumeration-safe for an unknown account', async () => {
    const adapter = adapterWith();
    vi.mocked(adapter.sendPasswordResetEmail).mockRejectedValue({
      code: 'auth/user-not-found',
      message: 'private account detail',
    });
    const service = new AuthenticationService(adapter);

    await expect(
      service.sendPasswordResetEmail('unknown@example.com'),
    ).resolves.toBeUndefined();
  });

  it('supports verification refresh, token retrieval, one token listener, and sign-out', async () => {
    const currentUser = user();
    const adapter = adapterWith(currentUser);
    const service = new AuthenticationService(adapter);
    const listener = vi.fn();

    service.onIdTokenChanged(listener);
    await service.refreshVerificationStatus();
    await expect(service.getIdToken()).resolves.toBe('firebase-id-token');
    await expect(service.getIdToken(true)).resolves.toBe('firebase-id-token');
    await service.signOut();

    expect(adapter.onIdTokenChanged).toHaveBeenCalledWith(listener);
    expect(currentUser.reload).toHaveBeenCalledTimes(1);
    expect(currentUser.getIdToken).toHaveBeenNthCalledWith(1, false);
    expect(currentUser.getIdToken).toHaveBeenNthCalledWith(2, true);
    expect(adapter.signOut).toHaveBeenCalledTimes(1);
  });

  it('resolves the current signed-out state when the native listener is delayed', async () => {
    const adapter = adapterWith(null);
    let nativeListener: ((user: FirebaseAuthUser | null) => void) | undefined;
    vi.mocked(adapter.onIdTokenChanged).mockImplementation((next) => {
      nativeListener = next;
      return vi.fn();
    });
    const service = new AuthenticationService(adapter);
    const listener = vi.fn();

    service.onIdTokenChanged(listener);
    await Promise.resolve();

    expect(listener).not.toHaveBeenCalled();
    nativeListener?.(null);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(null);
  });

  it('normalizes required auth categories', () => {
    expect(normalizeAuthError({ code: 'auth/too-many-requests' }).code).toBe(
      'tooManyRequests',
    );
    expect(
      normalizeAuthError({
        code: 'auth/account-exists-with-different-credential',
      }).code,
    ).toBe('providerConflict');
    expect(normalizeAuthError({ code: 'auth/popup-closed-by-user' }).code).toBe(
      'providerCancelled',
    );
  });
});
