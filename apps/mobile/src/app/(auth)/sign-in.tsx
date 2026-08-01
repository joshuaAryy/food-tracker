import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AppButton } from '@/components/app-button';
import { AuthBrandLockup } from '@/components/auth/auth-brand-lockup';
import { AuthFormField } from '@/components/auth/auth-form-field';
import { AuthProviderButtons } from '@/components/auth/auth-provider-buttons';
import { AuthShell } from '@/components/auth/auth-shell';
import { toUserFacingError } from '@/lib/user-facing-errors';
import { AppText } from '@/components/app-text';
import { pendingProviderCredential } from '@/services/pending-provider-state';
import { isAppleSignInEnabled } from '@/lib/apple-sign-in-config';

export interface SignInActions {
  signInWithEmail(email: string, password: string): Promise<unknown>;
  onApple(): Promise<unknown>;
  onGoogle(): Promise<unknown>;
}

export interface SignInScreenProps {
  appleSignInEnabled: boolean;
  actions: SignInActions;
  onCreateAccount: () => void;
  onForgotPassword: () => void;
  onProviderConflict?: ((email: string) => void) | undefined;
  onSignedIn?: ((user: unknown) => Promise<void> | void) | undefined;
}

type SignInFieldErrors = {
  email: string | undefined;
  password: string | undefined;
};

export function SignInScreen({
  appleSignInEnabled,
  actions,
  onCreateAccount,
  onForgotPassword,
  onProviderConflict,
  onSignedIn,
}: SignInScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SignInFieldErrors>({
    email: undefined,
    password: undefined,
  });
  const [loading, setLoading] = useState(false);

  async function runProviderAction(action: () => Promise<unknown>) {
    if (loading) return;
    setLoading(true);
    setSubmitError(null);
    try {
      await action();
    } catch (error) {
      if (errorCode(error) === 'providerConflict') {
        onProviderConflict?.(email.trim());
        return;
      }
      setSubmitError(toUserFacingError(error));
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (loading) return;
    const nextFieldErrors: SignInFieldErrors = {
      email: undefined,
      password: undefined,
    };
    if (email.trim() === '') nextFieldErrors.email = 'Enter your email.';
    if (password === '') nextFieldErrors.password = 'Enter your password.';
    setFieldErrors(nextFieldErrors);
    if (
      nextFieldErrors.email !== undefined ||
      nextFieldErrors.password !== undefined
    ) {
      return;
    }

    setLoading(true);
    setSubmitError(null);
    try {
      const user = await actions.signInWithEmail(email, password);
      await onSignedIn?.(user);
    } catch (error) {
      setSubmitError(
        toUserFacingError(
          error,
          'That email or password doesn’t match. Try again.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <View className="flex-1 gap-3 px-5 pb-8 pt-12">
        <AuthBrandLockup />
        <View className="mt-10 gap-2">
          <AppText variant="title" className="text-[34px] leading-[46px]">
            Welcome back
          </AppText>
          <AppText className="text-[14px] leading-[19px] text-[#6E6E6E]">
            Sign in to keep your food history, goals, and streaks together.
          </AppText>
        </View>
        <View className="mt-5 gap-3">
          <AuthProviderButtons
            appleSignInEnabled={appleSignInEnabled}
            disabled={loading}
            onApple={() => void runProviderAction(actions.onApple)}
            onGoogle={() => void runProviderAction(actions.onGoogle)}
          />
          <AuthFormField
            autoCapitalize="none"
            autoCorrect={false}
            error={fieldErrors.email}
            keyboardType="email-address"
            label="Email"
            onChangeText={(value) => {
              setEmail(value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            placeholder="you@example.com"
            textContentType="emailAddress"
            value={email}
          />
          <AuthFormField
            autoCapitalize="none"
            error={fieldErrors.password}
            label="Password"
            onChangeText={(value) => {
              setPassword(value);
              setFieldErrors((current) => ({
                ...current,
                password: undefined,
              }));
            }}
            placeholder="••••••••"
            secureTextEntry
            textContentType="password"
            value={password}
          />
          {submitError === null ? null : (
            <AppText
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              className="text-[13px] leading-[18px] text-red-500"
            >
              {submitError}
            </AppText>
          )}
          <Pressable
            accessibilityLabel="Forgot password?"
            accessibilityRole="button"
            className="self-end py-1 active:opacity-70"
            disabled={loading}
            onPress={onForgotPassword}
          >
            <AppText variant="label" className="text-[13px] leading-[18px]">
              Forgot password?
            </AppText>
          </Pressable>
          <AppButton
            accessibilityLabel="Sign in"
            className="h-[54px] rounded-[17px] border-[#0E0E0E]"
            loading={loading}
            onPress={() => void submit()}
          >
            Sign in
          </AppButton>
          <View className="mt-1 flex-row items-center justify-center gap-[5px]">
            <AppText
              variant="caption"
              className="text-[13px] leading-[18px] text-[#6E6E6E]"
            >
              Don’t have an account?
            </AppText>
            <Pressable
              accessibilityLabel="Create account"
              accessibilityRole="button"
              disabled={loading}
              onPress={onCreateAccount}
            >
              <AppText variant="label" className="text-[13px] leading-[18px]">
                Create account
              </AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </AuthShell>
  );
}

async function createDefaultSignInActions(
  appleSignInEnabled: boolean,
): Promise<SignInActions> {
  const [
    { createFirebaseAuthService },
    { signInWithApple },
    { createNativeAppleAuthenticationAdapter },
    { createNativeGoogleAuthenticationAdapter },
    { GoogleAuthenticationService },
  ] = await Promise.all([
    import('@/lib/firebase'),
    import('@/services/apple-authentication'),
    import('@/services/apple-authentication-native'),
    import('@/services/google-authentication-native'),
    import('@/services/google-authentication'),
  ]);
  const authService = createFirebaseAuthService();
  const appleAdapter = createNativeAppleAuthenticationAdapter();
  const googleService = new GoogleAuthenticationService(
    authService,
    createNativeGoogleAuthenticationAdapter(),
    pendingProviderCredential,
  );

  return {
    signInWithEmail: (email, password) =>
      authService.signInWithEmail(email, password),
    onApple: () =>
      signInWithApple(
        authService,
        appleAdapter,
        pendingProviderCredential,
        appleSignInEnabled,
      ),
    onGoogle: () =>
      googleService.signIn(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? ''),
  };
}

export default function SignInRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ linkPending?: string }>();
  const appleSignInEnabled = isAppleSignInEnabled();
  const [actions, setActions] = useState<SignInActions | null>(null);

  useEffect(() => {
    let active = true;
    void createDefaultSignInActions(appleSignInEnabled).then((nextActions) => {
      if (active) setActions(nextActions);
    });
    return () => {
      active = false;
    };
  }, [appleSignInEnabled]);

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
    <SignInScreen
      appleSignInEnabled={appleSignInEnabled}
      actions={actions}
      onCreateAccount={() => router.push('/create-account' as Href)}
      onForgotPassword={() => router.push('/forgot-password' as Href)}
      onProviderConflict={(email) =>
        router.push({
          pathname: '/provider-conflict',
          params: { email },
        } as Href)
      }
      onSignedIn={
        params.linkPending === '1'
          ? async (user) => {
              const [
                { createFirebaseProviderLinkingAdapter },
                { ProviderLinkingService },
              ] = await Promise.all([
                import('@/lib/firebase'),
                import('@/services/provider-linking'),
              ]);
              const linking = new ProviderLinkingService(
                pendingProviderCredential,
                createFirebaseProviderLinkingAdapter(),
              );
              await linking.linkPendingCredential(() =>
                Promise.resolve(
                  user as import('@/services/auth-service').FirebaseAuthUser,
                ),
              );
              router.replace('/' as Href);
            }
          : undefined
      }
    />
  );
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
