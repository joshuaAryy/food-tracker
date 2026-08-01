export type AuthSessionUser = {
  uid: string;
  emailVerified: boolean;
  providerIds: string[];
};

export type AuthState =
  | { status: 'initializing' }
  | { status: 'initializationFailed' }
  | { status: 'signedOut' }
  | { status: 'verificationRequired'; user: AuthSessionUser }
  | { status: 'signedInSetupUnknown'; user: AuthSessionUser }
  | { status: 'setupStatusUnavailable'; user: AuthSessionUser }
  | { status: 'signedInSetupIncomplete'; user: AuthSessionUser }
  | { status: 'signedInReady'; user: AuthSessionUser };

export type SessionInvalidationReason =
  | 'invalidToken'
  | 'expiredToken'
  | 'revokedToken'
  | 'disabledUser'
  | 'deletedUser'
  | 'wrongProject';

export type AuthStateEvent =
  | { type: 'sessionResolved'; user: AuthSessionUser | null }
  | { type: 'initializationFailed' }
  | { type: 'setupResolved'; isComplete: boolean }
  | { type: 'setupResolutionFailed' }
  | { type: 'sessionInvalidated'; reason: SessionInvalidationReason }
  | { type: 'signedOut' };

export function deriveAuthState(user: AuthSessionUser | null): AuthState {
  if (user === null) return { status: 'signedOut' };
  if (user.providerIds.includes('password') && !user.emailVerified) {
    return { status: 'verificationRequired', user };
  }
  return { status: 'signedInSetupUnknown', user };
}

export function transitionAuthState(
  state: AuthState,
  event: AuthStateEvent,
): AuthState {
  switch (event.type) {
    case 'sessionResolved':
      return deriveAuthState(event.user);
    case 'initializationFailed':
      return { status: 'initializationFailed' };
    case 'setupResolved':
      if (
        state.status !== 'signedInSetupUnknown' &&
        state.status !== 'signedInSetupIncomplete'
      ) {
        return state;
      }
      return {
        status: event.isComplete ? 'signedInReady' : 'signedInSetupIncomplete',
        user: state.user,
      };
    case 'setupResolutionFailed':
      if (state.status === 'signedInSetupUnknown') {
        return { status: 'setupStatusUnavailable', user: state.user };
      }
      return state;
    case 'sessionInvalidated':
    case 'signedOut':
      return { status: 'signedOut' };
  }
}
