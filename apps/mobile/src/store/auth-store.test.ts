import { describe, expect, it, vi } from 'vitest';
import {
  classifySetupStatusFailure,
  createAuthStore,
  type AuthStoreDependencies,
} from './auth-store';
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

  it('processes equivalent initial signed-out callbacks only once', async () => {
    let listener: ((currentUser: FirebaseAuthUser | null) => void) | undefined;
    const dependencies = dependenciesWith({
      subscribeToIdTokenChanges: vi.fn((next) => {
        listener = next;
        return vi.fn();
      }),
    });
    const store = createAuthStore(dependencies);
    const states: string[] = [];
    store.subscribe((state) => states.push(state.authState.status));

    store.getState().start();
    listener?.(null);
    await Promise.resolve();
    listener?.(null);

    expect(states).toEqual(['signedOut']);
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

  it('moves a verified session to safe recovery when setup resolution fails', async () => {
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
    await vi.waitFor(() => {
      expect(store.getState().authState.status).toBe('setupStatusUnavailable');
    });
  });

  it('keeps setup recovery stable until an explicit retry and classifies the safe failure category', async () => {
    let listener: ((currentUser: FirebaseAuthUser | null) => void) | undefined;
    const getSetupStatus = vi
      .fn()
      .mockRejectedValue({ code: 'NETWORK_ERROR', status: 0 });
    const dependencies = dependenciesWith({
      subscribeToIdTokenChanges: vi.fn((next) => {
        listener = next;
        return vi.fn();
      }),
      getSetupStatus,
    });
    const store = createAuthStore(dependencies);

    store.getState().start();
    listener?.(user());
    await vi.waitFor(() => {
      expect(store.getState().authState.status).toBe('setupStatusUnavailable');
    });
    listener?.(user());
    await Promise.resolve();

    expect(getSetupStatus).toHaveBeenCalledTimes(1);
    expect(dependencies.signOut).not.toHaveBeenCalled();
    expect(
      classifySetupStatusFailure({ code: 'NETWORK_ERROR', status: 0 }),
    ).toBe('network_unreachable');
    expect(
      classifySetupStatusFailure({ code: 'NETWORK_TIMEOUT', status: 0 }),
    ).toBe('timeout');
    expect(
      classifySetupStatusFailure({ code: 'INVALID_RESPONSE', status: 200 }),
    ).toBe('invalid_response');
    expect(classifySetupStatusFailure({ status: 401 })).toBe('unauthorized');
    expect(classifySetupStatusFailure({ status: 403 })).toBe('forbidden');
    expect(classifySetupStatusFailure({ status: 503 })).toBe('server_error');
  });

  it('retries setup recovery for the same authenticated session without signing out', async () => {
    let listener: ((currentUser: FirebaseAuthUser | null) => void) | undefined;
    const getSetupStatus = vi
      .fn()
      .mockRejectedValueOnce(new Error('private network detail'))
      .mockResolvedValueOnce({ isComplete: true });
    const dependencies = dependenciesWith({
      subscribeToIdTokenChanges: vi.fn((next) => {
        listener = next;
        return vi.fn();
      }),
      getSetupStatus,
    });
    const store = createAuthStore(dependencies);

    store.getState().start();
    listener?.(user());
    await vi.waitFor(() => {
      expect(store.getState().authState.status).toBe('setupStatusUnavailable');
    });

    store.getState().retrySetupStatus();

    await vi.waitFor(() => {
      expect(store.getState().authState.status).toBe('signedInReady');
    });
    expect(dependencies.signOut).not.toHaveBeenCalled();
    expect(getSetupStatus).toHaveBeenCalledTimes(2);
  });

  it('marks setup complete after successful onboarding without another session callback', async () => {
    let listener: ((currentUser: FirebaseAuthUser | null) => void) | undefined;
    const dependencies = dependenciesWith({
      getSetupStatus: vi.fn().mockResolvedValue({ isComplete: false }),
      subscribeToIdTokenChanges: vi.fn((next) => {
        listener = next;
        return vi.fn();
      }),
    });
    const store = createAuthStore(dependencies);

    store.getState().start();
    listener?.(user());
    await vi.waitFor(() => {
      expect(store.getState().authState.status).toBe('signedInSetupIncomplete');
    });

    store.getState().markSetupComplete();

    expect(store.getState().authState.status).toBe('signedInReady');
    expect(dependencies.getSetupStatus).toHaveBeenCalledTimes(1);
  });

  it('clears auth state before signing out the native session', async () => {
    const dependencies = dependenciesWith();
    const store = createAuthStore(dependencies);

    await store.getState().signOut();

    expect(store.getState().authState).toEqual({ status: 'signedOut' });
    expect(dependencies.signOut).toHaveBeenCalledTimes(1);
  });
});
