import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useRouter, useSegments, type Href } from 'expo-router';
import type { ApiAuthSession } from '@/lib/api-auth-session';
import { AuthRecoveryProvider } from '@/components/auth/auth-recovery-context';
import { routeForAuthState, routeMatchesAuthState } from '@/lib/auth-routing';
import type { AuthState } from '@/lib/auth-state';
import { createAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { pendingProviderCredential } from '@/services/pending-provider-state';
import type { AuthenticationService } from '@/services/auth-service';
import { GoogleAuthenticationService } from '@/services/google-authentication';
import { reportDiagnostic } from '@/lib/safe-diagnostics';

interface AuthRuntimeContextValue {
  userId: string | null;
  markSetupComplete(): void;
  providerIds: string[];
  deleteAccount(): Promise<void>;
  reauthenticateWithGoogle(): Promise<void>;
  reauthenticateWithPassword(password: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthRuntimeContext = createContext<AuthRuntimeContextValue | null>(null);

const unavailableAuthRuntime: AuthRuntimeContextValue = {
  userId: null,
  markSetupComplete: () => undefined,
  providerIds: [],
  deleteAccount: async () => {
    throw new Error('Authentication is still initializing.');
  },
  reauthenticateWithGoogle: async () => {
    throw new Error('Authentication is still initializing.');
  },
  reauthenticateWithPassword: async () => {
    throw new Error('Authentication is still initializing.');
  },
  signOut: async () => undefined,
};

export interface AuthBootstrapRuntime {
  authService: Pick<
    AuthenticationService,
    | 'getIdToken'
    | 'onIdTokenChanged'
    | 'reauthenticateWithCredential'
    | 'reauthenticateWithPassword'
    | 'signOut'
  >;
  deleteAccount(): Promise<void>;
  reauthenticateWithGoogle(): Promise<void>;
  getSetupStatus(): Promise<{ isComplete: boolean }>;
  configureApiSession(session: ApiAuthSession): void;
}

export async function loadAuthBootstrapRuntime(): Promise<AuthBootstrapRuntime> {
  const [firebase, apiClient, googleNative] = await Promise.all([
    import('@/lib/firebase'),
    import('@/lib/api-client'),
    import('@/services/google-authentication-native'),
  ]);
  const authService = firebase.createFirebaseAuthService();
  const googleService = new GoogleAuthenticationService(
    authService,
    googleNative.createNativeGoogleAuthenticationAdapter(),
  );
  return {
    authService,
    deleteAccount: async () => {
      await apiClient.api.account.delete();
    },
    reauthenticateWithGoogle: () =>
      googleService.reauthenticate(
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
      ),
    getSetupStatus: () => apiClient.api.setup.status(),
    configureApiSession: apiClient.configureApiAuthSession,
  };
}

export function useAuthRuntime(): AuthRuntimeContextValue {
  const value = useContext(AuthRuntimeContext);
  if (value === null) {
    throw new Error('Auth runtime is unavailable.');
  }
  return value;
}

interface AuthBootstrapProps extends PropsWithChildren {
  loadRuntime?: () => Promise<AuthBootstrapRuntime>;
}

export function AuthBootstrap({
  children,
  loadRuntime = loadAuthBootstrapRuntime,
}: AuthBootstrapProps) {
  const router = useRouter();
  const segments = useSegments();
  const [authState, setAuthState] = useState<AuthState>({
    status: 'initializing',
  });
  const [signOut, setSignOut] = useState<(() => Promise<void>) | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<
    (() => Promise<void>) | null
  >(null);
  const [reauthenticateWithGoogle, setReauthenticateWithGoogle] = useState<
    (() => Promise<void>) | null
  >(null);
  const [reauthenticateWithPassword, setReauthenticateWithPassword] = useState<
    ((password: string) => Promise<void>) | null
  >(null);
  const [markSetupComplete, setMarkSetupComplete] = useState<
    (() => void) | null
  >(null);
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const storeRef = useRef<ReturnType<typeof createAuthStore> | null>(null);
  const loadRuntimeRef = useRef(loadRuntime);
  const lastRedirectKeyRef = useRef<string | null>(null);

  const purgeCurrentAnalyticsCache = async () => {
    const state = storeRef.current?.getState().authState;
    if (state === undefined || !('user' in state)) return;
    try {
      const { purgeNativeAnalyticsCache } = await import(
        '@/lib/analytics/analytics-cache-native'
      );
      await purgeNativeAnalyticsCache(state.user.uid);
    } catch {
      // Local cache cleanup never blocks authentication lifecycle actions.
    }
  };

  useEffect(() => {
    let active = true;
    let stopStore: (() => void) | undefined;

    if (initializationAttempt > 0) {
      setAuthState({ status: 'initializing' });
      setSignOut(null);
      setMarkSetupComplete(null);
      setDeleteAccount(null);
      setReauthenticateWithGoogle(null);
      setReauthenticateWithPassword(null);
    }
    reportDiagnostic('auth_initialization_started');
    void loadRuntimeRef
      .current()
      .then((runtime) => {
        if (!active) return;
        const { authService } = runtime;
        runtime.configureApiSession({
          clearSession: () => {
            void authService.signOut();
          },
          getIdToken: async (forceRefresh) => {
            reportDiagnostic('token_request_started', {
              operation: forceRefresh ? 'forced_refresh' : 'initial',
            });
            try {
              const token = await authService.getIdToken(forceRefresh);
              reportDiagnostic('token_request_completed', {
                operation: forceRefresh ? 'forced_refresh' : 'initial',
              });
              return token;
            } catch (error) {
              reportDiagnostic('auth_initialization_failed', {
                operation: 'token_request',
                errorCategory: 'unavailable',
              });
              throw error;
            }
          },
        });
        const store = createAuthStore({
          getSetupStatus: runtime.getSetupStatus,
          signOut: () => authService.signOut(),
          subscribeToIdTokenChanges: (listener) =>
            authService.onIdTokenChanged(listener),
        });
        storeRef.current = store;
        const unsubscribe = store.subscribe((next) => {
          setAuthState(next.authState);
        });
        stopStore = () => {
          unsubscribe();
          store.getState().stop();
          if (storeRef.current === store) storeRef.current = null;
        };
        setSignOut(() => async () => {
          pendingProviderCredential.clear('signOut');
          await purgeCurrentAnalyticsCache();
          await store.getState().signOut();
          useAppStore.getState().resetUserData();
        });
        setMarkSetupComplete(() => () => store.getState().markSetupComplete());
        setDeleteAccount(() => async () => {
          if (runtime.deleteAccount === undefined) {
            throw new Error('Account deletion is unavailable.');
          }
          await runtime.deleteAccount();
          await purgeCurrentAnalyticsCache();
          try {
            await store.getState().signOut();
          } catch {
            // The server deletion is authoritative even if local cleanup fails.
          }
          useAppStore.getState().resetUserData();
        });
        setReauthenticateWithGoogle(
          () =>
            runtime.reauthenticateWithGoogle ??
            (async () => {
              throw new Error('Account reauthentication is unavailable.');
            }),
        );
        setReauthenticateWithPassword(
          () => (password: string) =>
            runtime.authService.reauthenticateWithPassword === undefined
              ? Promise.reject(
                  new Error('Account reauthentication is unavailable.'),
                )
              : runtime.authService.reauthenticateWithPassword(password),
        );
        store.getState().start();
      })
      .catch(() => {
        if (!active) return;
        reportDiagnostic('auth_initialization_failed', {
          operation: 'bootstrap_runtime',
          errorCategory: 'unavailable',
        });
        setAuthState({ status: 'initializationFailed' });
      });

    return () => {
      active = false;
      stopStore?.();
    };
  }, [initializationAttempt]);

  useEffect(() => {
    const matches = routeMatchesAuthState(authState, segments);
    const transientAuthRouteWhileSignedOut =
      authState.status === 'signedOut' &&
      segments[0] === '(auth)' &&
      (segments[1] === 'loading' || segments[1] === 'recovery');
    if (matches && !transientAuthRouteWhileSignedOut) return;
    const destination = routeForAuthState(authState) as Href;
    const redirectKey = `${segments.join('/')}=>${destination}`;
    if (lastRedirectKeyRef.current === redirectKey) return;
    lastRedirectKeyRef.current = redirectKey;
    reportDiagnostic('auth_route_selected', {
      operation:
        destination === '/(auth)/recovery' ? 'recovery' : 'state_transition',
    });
    router.replace(destination);
  }, [authState, router, segments]);

  const recovery =
    authState.status === 'initializationFailed' ||
    authState.status === 'setupStatusUnavailable'
      ? authState.status === 'initializationFailed'
        ? 'initialization'
        : 'setup'
      : undefined;
  return (
    <AuthRecoveryProvider
      value={{
        recovery,
        retry:
          recovery === 'initialization'
            ? () => setInitializationAttempt((attempt) => attempt + 1)
            : recovery === 'setup'
              ? () => storeRef.current?.getState().retrySetupStatus()
              : undefined,
        signOut: recovery === 'setup' && signOut !== null ? signOut : undefined,
      }}
    >
      <AuthRuntimeContext.Provider
        value={
          signOut === null ||
          markSetupComplete === null ||
          deleteAccount === null ||
          reauthenticateWithGoogle === null ||
          reauthenticateWithPassword === null
            ? unavailableAuthRuntime
            : {
                userId: 'user' in authState ? authState.user.uid : null,
                deleteAccount,
                markSetupComplete,
                providerIds:
                  'user' in authState ? authState.user.providerIds : [],
                reauthenticateWithGoogle,
                reauthenticateWithPassword,
                signOut,
              }
        }
      >
        {children}
      </AuthRuntimeContext.Provider>
    </AuthRecoveryProvider>
  );
}
