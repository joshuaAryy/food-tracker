import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { useRouter, useSegments, type Href } from 'expo-router';
import { AuthLoadingScreen } from '@/app/(auth)/loading';
import { configureApiAuthSession } from '@/lib/api-client';
import { routeForAuthState, routeMatchesAuthState } from '@/lib/auth-routing';
import type { AuthState } from '@/lib/auth-state';
import { createAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { pendingProviderCredential } from '@/services/pending-provider-state';

interface AuthRuntimeContextValue {
  signOut(): Promise<void>;
}

const AuthRuntimeContext = createContext<AuthRuntimeContextValue | null>(null);

export function useAuthRuntime(): AuthRuntimeContextValue {
  const value = useContext(AuthRuntimeContext);
  if (value === null) {
    throw new Error('Auth runtime is unavailable.');
  }
  return value;
}

export function AuthBootstrap({ children }: PropsWithChildren) {
  const router = useRouter();
  const segments = useSegments();
  const [authState, setAuthState] = useState<AuthState>({
    status: 'initializing',
  });
  const [signOut, setSignOut] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let active = true;
    let stopStore: (() => void) | undefined;

    void Promise.all([
      import('@/lib/firebase'),
      import('@/lib/api-client'),
    ]).then(([firebase, apiClient]) => {
      if (!active) return;
      const authService = firebase.createFirebaseAuthService();
      configureApiAuthSession({
        clearSession: () => {
          void authService.signOut();
        },
        getIdToken: (forceRefresh) => authService.getIdToken(forceRefresh),
      });
      const store = createAuthStore({
        getSetupStatus: () => apiClient.api.setup.status(),
        signOut: () => authService.signOut(),
        subscribeToIdTokenChanges: (listener) =>
          authService.onIdTokenChanged(listener),
      });
      const unsubscribe = store.subscribe((next) => {
        setAuthState(next.authState);
      });
      stopStore = () => {
        unsubscribe();
        store.getState().stop();
      };
      setSignOut(() => async () => {
        pendingProviderCredential.clear('signOut');
        await store.getState().signOut();
        useAppStore.getState().resetUserData();
      });
      store.getState().start();
    });

    return () => {
      active = false;
      stopStore?.();
    };
  }, []);

  useEffect(() => {
    const matches = routeMatchesAuthState(authState, segments);
    const loadingRouteWhileSignedOut =
      authState.status === 'signedOut' &&
      segments[0] === '(auth)' &&
      segments[1] === 'loading';
    if (matches && !loadingRouteWhileSignedOut) return;
    router.replace(routeForAuthState(authState) as Href);
  }, [authState, router, segments]);

  const matches = routeMatchesAuthState(authState, segments);
  const loadingRouteWhileSignedOut =
    authState.status === 'signedOut' &&
    segments[0] === '(auth)' &&
    segments[1] === 'loading';
  if (!matches || loadingRouteWhileSignedOut || signOut === null) {
    return <AuthLoadingScreen />;
  }

  return (
    <AuthRuntimeContext.Provider value={{ signOut }}>
      {children}
    </AuthRuntimeContext.Provider>
  );
}
