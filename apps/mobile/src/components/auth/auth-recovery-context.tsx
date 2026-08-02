import { createContext, useContext, type PropsWithChildren } from 'react';

export type AuthRecoveryKind = 'initialization' | 'setup';

export interface AuthRecoveryContextValue {
  recovery: AuthRecoveryKind | undefined;
  retry: (() => void) | undefined;
  signOut: (() => void | Promise<void>) | undefined;
}

const AuthRecoveryContext = createContext<AuthRecoveryContextValue>({
  recovery: undefined,
  retry: undefined,
  signOut: undefined,
});

export function AuthRecoveryProvider({
  value,
  children,
}: PropsWithChildren<{ value: AuthRecoveryContextValue }>) {
  return (
    <AuthRecoveryContext.Provider value={value}>
      {children}
    </AuthRecoveryContext.Provider>
  );
}

export function useAuthRecovery(): AuthRecoveryContextValue {
  return useContext(AuthRecoveryContext);
}
