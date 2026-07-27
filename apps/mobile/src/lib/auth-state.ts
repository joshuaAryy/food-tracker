export type AuthSessionUser = {
  uid: string;
  emailVerified: boolean;
  providerIds: string[];
};

export type AuthState =
  | { status: 'initializing' }
  | { status: 'signedOut' }
  | { status: 'verificationRequired'; user: AuthSessionUser }
  | { status: 'signedInSetupUnknown'; user: AuthSessionUser }
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
      return state;
    case 'sessionInvalidated':
    case 'signedOut':
      return { status: 'signedOut' };
  }
}
