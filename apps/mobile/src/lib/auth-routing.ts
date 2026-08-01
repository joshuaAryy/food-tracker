import type { AuthState } from './auth-state';

export type AuthDestination =
  | '/(auth)/loading'
  | '/(auth)/recovery'
  | '/(auth)/sign-in'
  | '/(auth)/verify-email'
  | '/(onboarding)'
  | '/(tabs)/progress';

export function routeForAuthState(state: AuthState): AuthDestination {
  switch (state.status) {
    case 'initializing':
    case 'signedInSetupUnknown':
      return '/(auth)/loading';
    case 'initializationFailed':
    case 'setupStatusUnavailable':
      return '/(auth)/recovery';
    case 'signedOut':
      return '/(auth)/sign-in';
    case 'verificationRequired':
      return '/(auth)/verify-email';
    case 'signedInSetupIncomplete':
      return '/(onboarding)';
    case 'signedInReady':
      return '/(tabs)/progress';
  }
}

export function routeMatchesAuthState(
  state: AuthState,
  segments: string[],
): boolean {
  const group = segments[0];
  switch (state.status) {
    case 'initializing':
      return group === '(auth)' && segments[1] === 'loading';
    case 'initializationFailed':
      return group === '(auth)' && segments[1] === 'recovery';
    case 'signedOut':
      return group === '(auth)';
    case 'verificationRequired':
      return group === '(auth)' && segments[1] === 'verify-email';
    case 'signedInSetupUnknown':
      return group === '(auth)' && segments[1] === 'loading';
    case 'setupStatusUnavailable':
      return group === '(auth)' && segments[1] === 'recovery';
    case 'signedInSetupIncomplete':
      return group === '(onboarding)';
    case 'signedInReady':
      return (
        group === '(tabs)' ||
        group === 'streaks' ||
        group === 'food-log' ||
        group === 'recipes' ||
        group === 'photo-log' ||
        group === 'barcode-scan' ||
        group === 'meal-describe' ||
        group === 'weight-log'
      );
  }
}
