import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { AppLogo } from '@/components/app-logo';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { api, errorMessage } from '@/lib/api-client';
import { colors } from '@/theme/tokens';

export default function IndexScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const checkSetup = useCallback(async () => {
    setError(null);

    try {
      const status = await api.setup.status();
      if (status.isComplete) {
        router.replace('/(tabs)/progress');
      } else {
        router.replace('/onboarding' as Href);
      }
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, [router]);

  useEffect(() => {
    void checkSetup();
  }, [checkSetup]);

  if (error !== null) {
    return (
      <SafeAreaView className="flex-1 bg-onboarding-canvas px-6">
        <View className="w-full max-w-[420px] flex-1 justify-center self-center">
          <View className="items-center gap-4 pb-8">
            <AppLogo size={56} tone="onboarding" />
            <View className="items-center gap-1">
              <AppText variant="heading" className="text-onboarding-text">
                Food Tracker
              </AppText>
              <AppText className="text-center text-onboarding-muted">
                Simple tracking, serious insight.
              </AppText>
            </View>
          </View>
          <ErrorState
            title="Food Tracker can’t reach the API"
            message={error}
          />
          <AppButton
            className="mt-5 border-onboarding-text bg-onboarding-text"
            onPress={() => void checkSetup()}
          >
            Try again
          </AppButton>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-onboarding-canvas px-6">
      <View className="w-full max-w-[420px] flex-1 items-center justify-center gap-5 self-center">
        <AppLogo size={62} tone="onboarding" />
        <View className="items-center gap-1">
          <AppText variant="heading" className="text-onboarding-text">
            Food Tracker
          </AppText>
          <AppText className="text-center text-onboarding-muted">
            Simple tracking, serious insight.
          </AppText>
        </View>
        <View className="mt-3 flex-row items-center gap-3">
          <ActivityIndicator color={colors.light.onboardingText} />
          <AppText variant="caption" className="text-onboarding-muted">
            Checking your setup
          </AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}
