import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AuthStatusScreen } from '@/components/auth/auth-status-screen';
import { pendingProviderCredential } from '@/services/pending-provider-state';

interface ProviderConflictScreenProps {
  email: string;
  onCancel: () => void;
  onSignInWithEmail: () => void;
}

export function ProviderConflictScreen({
  email,
  onCancel,
  onSignInWithEmail,
}: ProviderConflictScreenProps) {
  return (
    <AuthStatusScreen
      icon="account"
      message={`${email} was first created with email and password. Sign in that way once, then you can connect Apple or Google from your account settings.`}
      onPrimaryPress={onSignInWithEmail}
      onSecondaryPress={onCancel}
      primaryLabel="Sign in with email"
      secondaryLabel="Cancel"
      title="This email already has an account"
    />
  );
}

export default function ProviderConflictRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  return (
    <ProviderConflictScreen
      email={typeof params.email === 'string' ? params.email : 'This email'}
      onCancel={() => {
        pendingProviderCredential.clear('cancellation');
        router.back();
      }}
      onSignInWithEmail={() =>
        router.replace({
          pathname: '/sign-in',
          params: { linkPending: '1' },
        } as Href)
      }
    />
  );
}
