import { create } from 'zustand';
import {
  deriveAuthState,
  transitionAuthState,
  type AuthSessionUser,
  type AuthState,
} from '../lib/auth-state';
import type { FirebaseAuthUser } from '../services/auth-service';

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
  signOut(): Promise<void>;
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

  return create<AuthStoreState>((set, get) => ({
    authState: { status: 'initializing' },
    start() {
      if (started) return;
      started = true;
      unsubscribe = dependencies.subscribeToIdTokenChanges((user) => {
        const nextState = deriveAuthState(
          user === null ? null : sessionUser(user),
        );
        set({ authState: nextState });

        if (nextState.status !== 'signedInSetupUnknown') return;
        const userId = nextState.user.uid;
        void dependencies
          .getSetupStatus()
          .then((setupStatus) => {
            const currentState = get().authState;
            if (
              currentState.status !== 'signedInSetupUnknown' ||
              currentState.user.uid !== userId
            ) {
              return;
            }
            set({
              authState: transitionAuthState(currentState, {
                type: 'setupResolved',
                isComplete: setupStatus.isComplete,
              }),
            });
          })
          .catch(() => {
            const currentState = get().authState;
            if (
              currentState.status === 'signedInSetupUnknown' &&
              currentState.user.uid === userId
            ) {
              set({
                authState: transitionAuthState(currentState, {
                  type: 'setupResolutionFailed',
                }),
              });
            }
          });
      });
    },
    stop() {
      unsubscribe?.();
      unsubscribe = undefined;
      started = false;
    },
    async signOut() {
      set({ authState: { status: 'signedOut' } });
      await dependencies.signOut();
    },
  }));
}
