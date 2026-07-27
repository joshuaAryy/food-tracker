import { useRouter, type Href } from 'expo-router';
import { AuthStatusScreen } from '@/components/auth/auth-status-screen';
import { pendingProviderCredential } from '@/services/pending-provider-state';

interface ProviderCancelledScreenProps {
  onTryAgain: () => void;
  onUseEmail: () => void;
}

export function ProviderCancelledScreen({
  onTryAgain,
  onUseEmail,
}: ProviderCancelledScreenProps) {
  return (
    <AuthStatusScreen
      icon="warning"
      message="No changes were made. You can try Apple, Google, or email whenever you’re ready."
      onPrimaryPress={onTryAgain}
      onSecondaryPress={onUseEmail}
      primaryLabel="Try again"
      secondaryLabel="Use email instead"
      title="Sign-in cancelled"
    />
  );
}

export default function ProviderCancelledRoute() {
  const router = useRouter();
  return (
    <ProviderCancelledScreen
      onTryAgain={() => {
        pendingProviderCredential.clear('cancellation');
        router.back();
      }}
      onUseEmail={() => {
        pendingProviderCredential.clear('cancellation');
        router.replace('/sign-in' as Href);
      }}
    />
  );
}
