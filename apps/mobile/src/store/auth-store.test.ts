import { describe, expect, it, vi } from 'vitest';
import { createAuthStore, type AuthStoreDependencies } from './auth-store';
import type { FirebaseAuthUser } from '../services/auth-service';

function user(overrides: Partial<FirebaseAuthUser> = {}): FirebaseAuthUser {
  return {
    uid: 'firebase-user-1',
    email: 'user@example.com',
    emailVerified: true,
    displayName: null,
    photoUrl: null,
    providerIds: ['google.com'],
    updateProfile: vi.fn(),
    sendEmailVerification: vi.fn(),
    reload: vi.fn(),
    getIdToken: vi.fn(),
    ...overrides,
  };
}

function dependenciesWith(
  overrides: Partial<AuthStoreDependencies> = {},
): AuthStoreDependencies {
  return {
    subscribeToIdTokenChanges: vi.fn().mockReturnValue(vi.fn()),
    getSetupStatus: vi.fn().mockResolvedValue({ isComplete: true }),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('auth store', () => {
  it('subscribes once and resolves setup only after a verified session', async () => {
    let listener: ((currentUser: FirebaseAuthUser | null) => void) | undefined;
    const subscribeToIdTokenChanges = vi.fn((next) => {
      listener = next;
      return vi.fn();
    });
    const dependencies = dependenciesWith({ subscribeToIdTokenChanges });
    const store = createAuthStore(dependencies);

    store.getState().start();
    store.getState().start();
    listener?.(user());
    await Promise.resolve();

    expect(subscribeToIdTokenChanges).toHaveBeenCalledTimes(1);
    expect(store.getState().authState).toEqual({
      status: 'signedInReady',
      user: {
        uid: 'firebase-user-1',
        emailVerified: true,
        providerIds: ['google.com'],
      },
    });
  });

  it('blocks unverified password sessions without resolving setup', async () => {
    let listener: ((currentUser: FirebaseAuthUser | null) => void) | undefined;
    const getSetupStatus = vi.fn();
    const dependencies = dependenciesWith({
      subscribeToIdTokenChanges: vi.fn((next) => {
        listener = next;
        return vi.fn();
      }),
      getSetupStatus,
    });
    const store = createAuthStore(dependencies);

    store.getState().start();
    listener?.(user({ emailVerified: false, providerIds: ['password'] }));
    await Promise.resolve();

    expect(store.getState().authState.status).toBe('verificationRequired');
    expect(getSetupStatus).not.toHaveBeenCalled();
  });

  it('preserves an established session when setup resolution fails temporarily', async () => {
    let listener: ((currentUser: FirebaseAuthUser | null) => void) | undefined;
    const dependencies = dependenciesWith({
      subscribeToIdTokenChanges: vi.fn((next) => {
        listener = next;
        return vi.fn();
      }),
      getSetupStatus: vi
        .fn()
        .mockRejectedValue(new Error('private network detail')),
    });
    const store = createAuthStore(dependencies);

    store.getState().start();
    listener?.(user());
    await Promise.resolve();

    expect(store.getState().authState.status).toBe('signedInSetupUnknown');
  });

  it('clears auth state before signing out the native session', async () => {
    const dependencies = dependenciesWith();
    const store = createAuthStore(dependencies);

    await store.getState().signOut();

    expect(store.getState().authState).toEqual({ status: 'signedOut' });
    expect(dependencies.signOut).toHaveBeenCalledTimes(1);
  });
});
