import { create } from 'zustand';
import {
  deriveAuthState,
  transitionAuthState,
  type AuthSessionUser,
  type AuthState,
} from '../lib/auth-state';
import type { FirebaseAuthUser } from '../services/auth-service';
import { reportDiagnostic } from '../lib/safe-diagnostics';

export interface AuthStoreDependencies {
  subscribeToIdTokenChanges(
    listener: (currentUser: FirebaseAuthUser | null) => void,
  ): () => void;
  getSetupStatus(): Promise<{ isComplete: boolean }>;
  signOut(): Promise<void>;
}

export interface AuthStoreState {
  authState: AuthState;
  start(): void;
  stop(): void;
  markSetupComplete(): void;
  retrySetupStatus(): void;
  signOut(): Promise<void>;
}

type SetupStatusFailureCategory =
  | 'network_unreachable'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'server_error'
  | 'invalid_response'
  | 'unknown_unavailable';

export function classifySetupStatusFailure(
  error: unknown,
): SetupStatusFailureCategory {
  if (typeof error !== 'object' || error === null) {
    return 'unknown_unavailable';
  }
  const { code, status } = error as { code?: unknown; status?: unknown };
  if (code === 'NETWORK_ERROR') return 'network_unreachable';
  if (code === 'NETWORK_TIMEOUT') return 'timeout';
  if (code === 'INVALID_RESPONSE') return 'invalid_response';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (typeof status === 'number' && status >= 500 && status <= 599) {
    return 'server_error';
  }
  return 'unknown_unavailable';
}

function sessionUser(user: FirebaseAuthUser): AuthSessionUser {
  return {
    uid: user.uid,
    emailVerified: user.emailVerified,
    providerIds: [...new Set(user.providerIds)],
  };
}

export function createAuthStore(
  dependencies: AuthStoreDependencies,
): ReturnType<typeof createAuthStoreState> {
  return createAuthStoreState(dependencies);
}

function createAuthStoreState(dependencies: AuthStoreDependencies) {
  let unsubscribe: (() => void) | undefined;
  let started = false;
  let initialStateReceived = false;
  let lastSessionSignature: string | undefined;
  let setupRequestVersion = 0;

  function sessionSignature(user: FirebaseAuthUser | null): string {
    if (user === null) return 'signed_out';
    return [
      user.uid,
      user.emailVerified ? 'verified' : 'unverified',
      [...user.providerIds].sort().join(','),
    ].join('|');
  }

  function resolveSetupStatus(
    user: AuthSessionUser,
    set: (state: Partial<AuthStoreState>) => void,
    get: () => AuthStoreState,
  ) {
    const requestVersion = ++setupRequestVersion;
    reportDiagnostic('backend_session_started', { operation: 'setup_status' });
    reportDiagnostic('setup_status_started', { operation: 'setup_status' });
    void dependencies
      .getSetupStatus()
      .then((setupStatus) => {
        if (requestVersion !== setupRequestVersion) return;
        const currentState = get().authState;
        if (
          currentState.status !== 'signedInSetupUnknown' ||
          currentState.user.uid !== user.uid
        ) {
          return;
        }
        reportDiagnostic('backend_session_completed', {
          operation: 'setup_status',
        });
        reportDiagnostic('setup_status_completed', {
          operation: 'setup_status',
        });
        set({
          authState: transitionAuthState(currentState, {
            type: 'setupResolved',
            isComplete: setupStatus.isComplete,
          }),
        });
        reportDiagnostic('auth_initialization_completed', {
          operation: 'setup_status',
        });
      })
      .catch((error: unknown) => {
        if (requestVersion !== setupRequestVersion) return;
        const currentState = get().authState;
        if (
          currentState.status === 'signedInSetupUnknown' &&
          currentState.user.uid === user.uid
        ) {
          reportDiagnostic('auth_initialization_failed', {
            operation: 'setup_status',
            errorCategory: classifySetupStatusFailure(error),
          });
          set({
            authState: transitionAuthState(currentState, {
              type: 'setupResolutionFailed',
            }),
          });
        }
      });
  }

  return create<AuthStoreState>((set, get) => ({
    authState: { status: 'initializing' },
    start() {
      if (started) return;
      started = true;
      unsubscribe = dependencies.subscribeToIdTokenChanges((user) => {
        const nextSessionSignature = sessionSignature(user);
        if (
          initialStateReceived &&
          lastSessionSignature === nextSessionSignature
        ) {
          return;
        }
        if (!initialStateReceived) {
          initialStateReceived = true;
          reportDiagnostic('firebase_initial_state_received');
        }
        lastSessionSignature = nextSessionSignature;
        reportDiagnostic(
          user === null ? 'firebase_user_absent' : 'firebase_user_present',
        );
        const nextState = deriveAuthState(
          user === null ? null : sessionUser(user),
        );
        set({ authState: nextState });

        if (nextState.status === 'signedOut') {
          reportDiagnostic('auth_initialization_completed', {
            operation: 'signed_out',
          });
          return;
        }
        if (nextState.status === 'verificationRequired') {
          reportDiagnostic('auth_initialization_completed', {
            operation: 'verification_required',
          });
          return;
        }
        if (nextState.status === 'signedInSetupUnknown') {
          resolveSetupStatus(nextState.user, set, get);
        }
      });
      reportDiagnostic('firebase_listener_registered');
    },
    stop() {
      setupRequestVersion += 1;
      unsubscribe?.();
      unsubscribe = undefined;
      started = false;
      initialStateReceived = false;
      lastSessionSignature = undefined;
    },
    markSetupComplete() {
      const currentState = get().authState;
      set({
        authState: transitionAuthState(currentState, {
          type: 'setupResolved',
          isComplete: true,
        }),
      });
    },
    retrySetupStatus() {
      const currentState = get().authState;
      if (currentState.status !== 'setupStatusUnavailable') return;
      const retryingState = {
        status: 'signedInSetupUnknown' as const,
        user: currentState.user,
      };
      set({ authState: retryingState });
      resolveSetupStatus(retryingState.user, set, get);
    },
    async signOut() {
      setupRequestVersion += 1;
      set({ authState: { status: 'signedOut' } });
      await dependencies.signOut();
    },
  }));
}
