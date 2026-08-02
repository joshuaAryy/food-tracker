import { describe, expect, it } from 'vitest';
import {
  deriveAuthState,
  transitionAuthState,
  type AuthSessionUser,
  type AuthState,
} from './auth-state';

const user: AuthSessionUser = {
  uid: 'firebase-user-1',
  emailVerified: true,
  providerIds: ['google.com'],
};

describe('authentication state machine', () => {
  it('starts in initializing and resolves a missing session to signed out', () => {
    const initial: AuthState = { status: 'initializing' };

    expect(
      transitionAuthState(initial, { type: 'sessionResolved', user: null }),
    ).toEqual({ status: 'signedOut' });
  });

  it('requires verification for password users before setup resolution', () => {
    expect(
      deriveAuthState({
        ...user,
        emailVerified: false,
        providerIds: ['password'],
      }),
    ).toEqual({
      status: 'verificationRequired',
      user: { ...user, emailVerified: false, providerIds: ['password'] },
    });
  });

  it('resolves verified sessions through unknown, incomplete, and ready setup states', () => {
    const unknown = deriveAuthState(user);
    expect(unknown).toEqual({ status: 'signedInSetupUnknown', user });
    const incomplete = transitionAuthState(unknown, {
      type: 'setupResolved',
      isComplete: false,
    });
    expect(incomplete).toEqual({ status: 'signedInSetupIncomplete', user });
    expect(
      transitionAuthState(incomplete, {
        type: 'setupResolved',
        isComplete: true,
      }),
    ).toEqual({ status: 'signedInReady', user });
  });

  it('preserves an established session during temporary setup failure', () => {
    const state: AuthState = { status: 'signedInReady', user };

    expect(
      transitionAuthState(state, { type: 'setupResolutionFailed' }),
    ).toEqual(state);
  });

  it.each([
    'invalidToken',
    'expiredToken',
    'revokedToken',
    'disabledUser',
    'deletedUser',
    'wrongProject',
  ] as const)('clears the session on %s', (failure) => {
    const state: AuthState = { status: 'signedInReady', user };

    expect(
      transitionAuthState(state, {
        type: 'sessionInvalidated',
        reason: failure,
      }),
    ).toEqual({ status: 'signedOut' });
  });

  it('clears user-specific state on explicit sign-out', () => {
    expect(
      transitionAuthState(
        { status: 'signedInSetupIncomplete', user },
        { type: 'signedOut' },
      ),
    ).toEqual({ status: 'signedOut' });
  });
});
