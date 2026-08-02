import { AuthLoadingScreen } from './loading';
import { useAuthRecovery } from '@/components/auth/auth-recovery-context';

export default function AuthRecoveryRoute() {
  const { recovery, retry, signOut } = useAuthRecovery();

  return (
    <AuthLoadingScreen
      recovery={recovery}
      onRetry={retry}
      onSignOut={signOut}
    />
  );
}
