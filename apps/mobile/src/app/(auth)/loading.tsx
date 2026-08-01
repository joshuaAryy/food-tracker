import { View } from 'react-native';
import { AuthBrandLockup } from '@/components/auth/auth-brand-lockup';
import { AuthLoadingIndicators } from '@/components/auth/auth-loading-indicators';
import { AuthShell } from '@/components/auth/auth-shell';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';

interface AuthLoadingScreenProps {
  recovery?: 'initialization' | 'setup' | undefined;
  onRetry?: (() => void) | undefined;
  onSignOut?: (() => void | Promise<void>) | undefined;
}

export function AuthLoadingScreen({
  recovery,
  onRetry,
  onSignOut,
}: AuthLoadingScreenProps) {
  const isSetupRecovery = recovery === 'setup';
  const heading = isSetupRecovery
    ? 'We couldn’t load your account'
    : 'Signing you in…';
  const supportingCopy = isSetupRecovery
    ? 'You’re signed in, but we couldn’t retrieve your setup information. Check your connection and try again.'
    : 'Restoring your secure session and account data.';
  const recoveryCopy =
    recovery === 'initialization'
      ? 'We couldn’t start your session. Try again.'
      : undefined;

  return (
    <AuthShell>
      <View className="flex-1 items-center bg-white px-5 pt-44">
        <AuthBrandLockup />
        <View className="mt-32 items-center gap-5">
          <AuthLoadingIndicators active={recovery === undefined}>
            {({ dots, spinner }) => (
              <>
                {dots}
                <AppText variant="heading" className="text-[24px] leading-8">
                  {heading}
                </AppText>
                <AppText className="text-center text-[14px] leading-[19px] text-[#6E6E6E]">
                  {supportingCopy}
                </AppText>
                {spinner}
                {recovery === undefined ? null : (
                  <View className="items-center gap-3 pt-2">
                    {recoveryCopy === undefined ? null : (
                      <AppText className="text-center text-[14px] leading-[19px] text-[#6E6E6E]">
                        {recoveryCopy}
                      </AppText>
                    )}
                    {onRetry === undefined ? null : (
                      <AppButton variant="secondary" onPress={onRetry}>
                        Try again
                      </AppButton>
                    )}
                    {onSignOut === undefined ? null : (
                      <AppButton variant="ghost" onPress={onSignOut}>
                        Sign out
                      </AppButton>
                    )}
                  </View>
                )}
              </>
            )}
          </AuthLoadingIndicators>
        </View>
      </View>
    </AuthShell>
  );
}

export default function AuthLoadingRoute() {
  return <AuthLoadingScreen />;
}
