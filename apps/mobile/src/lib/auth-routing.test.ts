import { describe, expect, it } from 'vitest';
import type { AuthState } from './auth-state';
import {
  AUTHENTICATED_ROOT_ROUTE_GROUPS,
  routeForAuthState,
  routeMatchesAuthState,
} from './auth-routing';

describe('authentication routing', () => {
  it.each([
    [{ status: 'initializing' }, '/(auth)/loading'],
    [{ status: 'signedOut' }, '/(auth)/sign-in'],
    [
      {
        status: 'verificationRequired',
        user: { uid: 'u', emailVerified: false, providerIds: ['password'] },
      },
      '/(auth)/verify-email',
    ],
    [
      {
        status: 'signedInSetupUnknown',
        user: { uid: 'u', emailVerified: true, providerIds: ['google.com'] },
      },
      '/(auth)/loading',
    ],
    [
      {
        status: 'setupStatusUnavailable',
        user: { uid: 'u', emailVerified: true, providerIds: ['google.com'] },
      },
      '/(auth)/recovery',
    ],
    [
      {
        status: 'signedInSetupIncomplete',
        user: { uid: 'u', emailVerified: true, providerIds: ['google.com'] },
      },
      '/(onboarding)',
    ],
    [
      {
        status: 'signedInReady',
        user: { uid: 'u', emailVerified: true, providerIds: ['google.com'] },
      },
      '/(tabs)/progress',
    ],
  ] as const)('derives the protected destination for %j', (state, route) => {
    expect(routeForAuthState(state as AuthState)).toBe(route);
  });

  it('does not allow protected groups while signed out or verification-required', () => {
    expect(
      routeMatchesAuthState({ status: 'signedOut' }, ['(tabs)', 'progress']),
    ).toBe(false);
    expect(
      routeMatchesAuthState(
        {
          status: 'verificationRequired',
          user: { uid: 'u', emailVerified: false, providerIds: ['password'] },
        },
        ['(tabs)', 'progress'],
      ),
    ).toBe(false);
    expect(
      routeMatchesAuthState(
        {
          status: 'signedInReady',
          user: { uid: 'u', emailVerified: true, providerIds: ['google.com'] },
        },
        ['(tabs)', 'progress'],
      ),
    ).toBe(true);
    expect(
      routeMatchesAuthState(
        {
          status: 'signedInReady',
          user: { uid: 'u', emailVerified: true, providerIds: ['google.com'] },
        },
        ['recipes', 'index'],
      ),
    ).toBe(true);
  });

  it('keeps every registered authenticated root route and analytics child route in place', () => {
    expect(AUTHENTICATED_ROOT_ROUTE_GROUPS).toEqual([
      '(tabs)',
      'index',
      'streaks',
      'trends',
      'food-log',
      'recipes',
      'photo-log',
      'barcode-scan',
      'meal-describe',
      'weight-log',
      'water-log',
    ]);

    const ready: AuthState = {
      status: 'signedInReady',
      user: { uid: 'u', emailVerified: true, providerIds: ['google.com'] },
    };
    for (const segments of [
      ['trends'],
      ['trends', 'calories'],
      ['trends', 'nutrients'],
      ['trends', 'saved-views'],
      ['trends', 'configure'],
      ['trends', 'custom-range'],
      ['water-log'],
    ]) {
      expect(routeMatchesAuthState(ready, segments)).toBe(true);
    }
  });
});
