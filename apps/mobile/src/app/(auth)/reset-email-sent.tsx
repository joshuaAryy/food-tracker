import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AuthStatusScreen } from '@/components/auth/auth-status-screen';

interface ResetEmailSentScreenProps {
  email: string;
  onResend: () => void;
  onSignIn: () => void;
}

export function ResetEmailSentScreen({
  email,
  onResend,
  onSignIn,
}: ResetEmailSentScreenProps) {
  return (
    <AuthStatusScreen
      icon="success"
      message={`Check ${email} for a password reset link. The link will expire for your security.`}
      onPrimaryPress={onSignIn}
      onSecondaryPress={onResend}
      primaryLabel="Return to sign in"
      secondaryLabel="Send another link"
      title="Reset link sent"
    />
  );
}

export default function ResetEmailSentRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : 'your email';
  return (
    <ResetEmailSentScreen
      email={email}
      onResend={() => router.replace('/forgot-password' as Href)}
      onSignIn={() => router.replace('/sign-in' as Href)}
    />
  );
}
