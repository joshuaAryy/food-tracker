import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { AuthBrandLockup } from '@/components/auth/auth-brand-lockup';
import { AuthFormField } from '@/components/auth/auth-form-field';
import { AuthShell } from '@/components/auth/auth-shell';
import { toUserFacingError } from '@/lib/user-facing-errors';

interface ForgotPasswordActions {
  sendPasswordReset(email: string): Promise<void>;
}

interface ForgotPasswordScreenProps {
  actions: ForgotPasswordActions;
  onSent: (email: string) => void;
  onSignIn: () => void;
}

export function ForgotPasswordScreen({
  actions,
  onSent,
  onSignIn,
}: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (loading) return;
    if (email.trim() === '') {
      setError('Enter your email.');
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      await actions.sendPasswordReset(email.trim());
      onSent(email.trim());
    } catch (cause) {
      setError(toUserFacingError(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <View className="flex-1 gap-3 bg-white px-5 pb-8 pt-12">
        <AuthBrandLockup />
        <View className="mt-12 gap-3">
          <AppText variant="title" className="text-[32px] leading-[39px]">
            Reset your password
          </AppText>
          <AppText className="text-[14px] leading-[19px] text-[#6E6E6E]">
            Enter the email connected to your account. We’ll send you a secure
            reset link.
          </AppText>
        </View>
        <View className="mt-8 gap-3">
          <AuthFormField
            autoCapitalize="none"
            autoCorrect={false}
            error={error}
            keyboardType="email-address"
            label="Email"
            onChangeText={(value) => {
              setEmail(value);
              setError(undefined);
            }}
            placeholder="you@example.com"
            textContentType="emailAddress"
            value={email}
          />
          <AppButton
            accessibilityLabel="Send reset link"
            className="h-[54px] rounded-[17px] border-[#0E0E0E]"
            loading={loading}
            onPress={() => void submit()}
          >
            Send reset link
          </AppButton>
        </View>
        <View className="mt-1 flex-row items-center justify-center gap-[5px]">
          <AppText
            variant="caption"
            className="text-[13px] leading-[18px] text-[#6E6E6E]"
          >
            Remembered it?
          </AppText>
          <Pressable
            accessibilityLabel="Back to sign in"
            accessibilityRole="button"
            disabled={loading}
            onPress={onSignIn}
          >
            <AppText variant="label" className="text-[13px] leading-[18px]">
              Back to sign in
            </AppText>
          </Pressable>
        </View>
      </View>
    </AuthShell>
  );
}

async function createDefaultForgotPasswordActions(): Promise<ForgotPasswordActions> {
  const { createFirebaseAuthService } = await import('@/lib/firebase');
  const authService = createFirebaseAuthService();
  return {
    sendPasswordReset: (email) => authService.sendPasswordResetEmail(email),
  };
}

export default function ForgotPasswordRoute() {
  const router = useRouter();
  const [actions, setActions] = useState<ForgotPasswordActions | null>(null);

  useEffect(() => {
    let active = true;
    void createDefaultForgotPasswordActions().then((nextActions) => {
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
    <ForgotPasswordScreen
      actions={actions}
      onSent={(email) =>
        router.push({
          pathname: '/reset-email-sent',
          params: { email },
        } as Href)
      }
      onSignIn={() => router.replace('/sign-in' as Href)}
    />
  );
}
