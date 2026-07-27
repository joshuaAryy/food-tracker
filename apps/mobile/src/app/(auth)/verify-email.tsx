import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Mail } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { AuthBrandLockup } from '@/components/auth/auth-brand-lockup';
import { AuthShell } from '@/components/auth/auth-shell';
import { toUserFacingError } from '@/lib/user-facing-errors';

interface VerifyEmailActions {
  resendVerification(): Promise<void>;
  refreshVerification(): Promise<{ emailVerified: boolean }>;
}

interface VerifyEmailScreenProps {
  actions: VerifyEmailActions;
  email: string;
  onDifferentEmail: () => void;
  onVerified: () => void;
}

export function VerifyEmailScreen({
  actions,
  email,
  onDifferentEmail,
  onVerified,
}: VerifyEmailScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function resend() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await actions.resendVerification();
      setSuccess('Verification email sent.');
    } catch (cause) {
      setError(toUserFacingError(cause));
    } finally {
      setLoading(false);
    }
  }

  async function checkVerification() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const user = await actions.refreshVerification();
      if (user.emailVerified) {
        onVerified();
      } else {
        setError('Check your inbox and try again.');
      }
    } catch (cause) {
      setError(toUserFacingError(cause, 'Check your inbox and try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <View className="flex-1 gap-3 bg-white px-5 pb-8 pt-12">
        <AuthBrandLockup />
        <View className="mt-20 gap-5">
          <View
            accessibilityLabel="Email verification status"
            className="h-16 w-16 items-center justify-center rounded-[20px] bg-[#E8F7EF]"
          >
            <Mail color="#0E0E0E" size={28} strokeWidth={2.2} />
          </View>
          <View className="gap-3">
            <AppText variant="title" className="text-[32px] leading-[39px]">
              Check your inbox
            </AppText>
            <AppText className="text-[15px] leading-5 text-[#6E6E6E]">
              We sent a verification link to {email}. Verify your email to
              continue.
            </AppText>
          </View>
        </View>
        <View className="mt-7 gap-3">
          {error === null ? null : (
            <AppText
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              className="text-[13px] leading-[18px] text-red-500"
            >
              {error}
            </AppText>
          )}
          {success === null ? null : (
            <AppText
              accessibilityLiveRegion="polite"
              className="text-[13px] leading-[18px] text-[#0E7A43]"
            >
              {success}
            </AppText>
          )}
          <AppButton
            accessibilityLabel="I’ve verified my email"
            className="h-[54px] rounded-[17px] border-[#0E0E0E]"
            loading={loading}
            onPress={() => void checkVerification()}
          >
            I’ve verified my email
          </AppButton>
          <AppButton
            accessibilityLabel="Resend verification email"
            className="h-[54px] rounded-[17px] border border-[#E0E0DB] bg-white"
            disabled={loading}
            variant="secondary"
            onPress={() => void resend()}
          >
            Resend verification email
          </AppButton>
          <Pressable
            accessibilityLabel="Use a different email"
            accessibilityRole="button"
            className="self-center py-1 active:opacity-70"
            disabled={loading}
            onPress={onDifferentEmail}
          >
            <AppText
              variant="caption"
              className="text-[13px] leading-[18px] text-[#6E6E6E]"
            >
              Wrong email?{' '}
              <AppText variant="label" className="text-[13px] leading-[18px]">
                Use a different email
              </AppText>
            </AppText>
          </Pressable>
        </View>
        <View className="flex-1" />
        {loading ? <ActivityIndicator color="#0E0E0E" /> : null}
      </View>
    </AuthShell>
  );
}

async function createDefaultVerifyEmailActions(): Promise<VerifyEmailActions> {
  const { createFirebaseAuthService } = await import('@/lib/firebase');
  const authService = createFirebaseAuthService();
  return {
    resendVerification: () => authService.resendVerification(),
    refreshVerification: async () => {
      const user = await authService.refreshVerificationStatus();
      return { emailVerified: user.emailVerified };
    },
  };
}

export default function VerifyEmailRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [actions, setActions] = useState<VerifyEmailActions | null>(null);

  useEffect(() => {
    let active = true;
    void createDefaultVerifyEmailActions().then((nextActions) => {
      if (active) setActions(nextActions);
    });
    return () => {
      active = false;
    };
  }, []);

  if (actions === null) {
    return (
      <AuthShell>
        <View className="flex-1 items-center justify-center gap-5 bg-white">
          <AuthBrandLockup />
          <ActivityIndicator color="#0E0E0E" />
          <AppText variant="heading">Signing you in…</AppText>
        </View>
      </AuthShell>
    );
  }

  return (
    <VerifyEmailScreen
      actions={actions}
      email={typeof params.email === 'string' ? params.email : 'your email'}
      onDifferentEmail={() => router.replace('/create-account' as Href)}
      onVerified={() => router.replace('/' as Href)}
    />
  );
}
