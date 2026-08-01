import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { AuthBrandLockup } from '@/components/auth/auth-brand-lockup';
import { AuthFormField } from '@/components/auth/auth-form-field';
import { AuthProviderButtons } from '@/components/auth/auth-provider-buttons';
import { AuthShell } from '@/components/auth/auth-shell';
import { toUserFacingError } from '@/lib/user-facing-errors';
import { pendingProviderCredential } from '@/services/pending-provider-state';
import { isAppleSignInEnabled } from '@/lib/apple-sign-in-config';

export interface CreateAccountActions {
  createAccount(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<unknown>;
  onApple(): Promise<unknown>;
  onGoogle(): Promise<unknown>;
}

interface CreateAccountScreenProps {
  appleSignInEnabled: boolean;
  actions: CreateAccountActions;
  onCreated: (email: string) => void;
  onSignIn: () => void;
  onProviderConflict?: ((email: string) => void) | undefined;
}

type CreateAccountFieldErrors = {
  name: string | undefined;
  email: string | undefined;
  password: string | undefined;
};

export function CreateAccountScreen({
  appleSignInEnabled,
  actions,
  onCreated,
  onSignIn,
  onProviderConflict,
}: CreateAccountScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<CreateAccountFieldErrors>({
    name: undefined,
    email: undefined,
    password: undefined,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
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
    const nextFieldErrors: CreateAccountFieldErrors = {
      name: name.trim() === '' ? 'Enter your name.' : undefined,
      email: email.trim() === '' ? 'Enter your email.' : undefined,
      password: password.length < 8 ? 'Minimum 8 characters.' : undefined,
    };
    setFieldErrors(nextFieldErrors);
    if (
      nextFieldErrors.name !== undefined ||
      nextFieldErrors.email !== undefined ||
      nextFieldErrors.password !== undefined
    ) {
      return;
    }

    setLoading(true);
    setSubmitError(null);
    try {
      await actions.createAccount({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      onCreated(email.trim());
    } catch (error) {
      setSubmitError(toUserFacingError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <View className="flex-1 gap-3 px-5 pb-8 pt-12">
        <AuthBrandLockup />
        <View className="mt-2 gap-2">
          <AppText variant="title" className="text-[32px] leading-[43px]">
            Create your account
          </AppText>
          <AppText className="text-[14px] leading-[19px] text-[#6E6E6E]">
            Use the sign-in method you’ll want to keep long term.
          </AppText>
        </View>
        <View className="mt-1 gap-3">
          <AuthProviderButtons
            appleSignInEnabled={appleSignInEnabled}
            disabled={loading}
            onApple={() => void runProviderAction(actions.onApple)}
            onGoogle={() => void runProviderAction(actions.onGoogle)}
          />
          <AuthFormField
            autoCapitalize="words"
            error={fieldErrors.name}
            label="Name"
            onChangeText={(value) => {
              setName(value);
              setFieldErrors((current) => ({ ...current, name: undefined }));
            }}
            placeholder="Joshua Aryeetey"
            textContentType="name"
            value={name}
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
            hint="Minimum 8 characters."
            label="Password"
            onChangeText={(value) => {
              setPassword(value);
              setFieldErrors((current) => ({
                ...current,
                password: undefined,
              }));
            }}
            placeholder="At least 8 characters"
            secureTextEntry
            textContentType="newPassword"
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
          <AppButton
            accessibilityLabel="Create account"
            className="h-[54px] rounded-[17px] border-[#0E0E0E]"
            loading={loading}
            onPress={() => void submit()}
          >
            Create account
          </AppButton>
          <View className="mt-1 flex-row items-center justify-center gap-[5px]">
            <AppText
              variant="caption"
              className="text-[13px] leading-[18px] text-[#6E6E6E]"
            >
              Already have an account?
            </AppText>
            <Pressable
              accessibilityLabel="Sign in"
              accessibilityRole="button"
              disabled={loading}
              onPress={onSignIn}
            >
              <AppText variant="label" className="text-[13px] leading-[18px]">
                Sign in
              </AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </AuthShell>
  );
}

async function createDefaultCreateAccountActions(
  appleSignInEnabled: boolean,
): Promise<CreateAccountActions> {
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
  const googleService = new GoogleAuthenticationService(
    authService,
    createNativeGoogleAuthenticationAdapter(),
    pendingProviderCredential,
  );
  return {
    createAccount: (input) => authService.createAccount(input),
    onApple: () =>
      signInWithApple(
        authService,
        createNativeAppleAuthenticationAdapter(),
        pendingProviderCredential,
        appleSignInEnabled,
      ),
    onGoogle: () =>
      googleService.signIn(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? ''),
  };
}

export default function CreateAccountRoute() {
  const router = useRouter();
  const appleSignInEnabled = isAppleSignInEnabled();
  const [actions, setActions] = useState<CreateAccountActions | null>(null);

  useEffect(() => {
    let active = true;
    void createDefaultCreateAccountActions(appleSignInEnabled).then(
      (nextActions) => {
        if (active) setActions(nextActions);
      },
    );
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
    <CreateAccountScreen
      appleSignInEnabled={appleSignInEnabled}
      actions={actions}
      onCreated={(email) =>
        router.push({ pathname: '/verify-email', params: { email } } as Href)
      }
      onProviderConflict={(email) =>
        router.push({
          pathname: '/provider-conflict',
          params: { email },
        } as Href)
      }
      onSignIn={() => router.push('/sign-in' as Href)}
    />
  );
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
