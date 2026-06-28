import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from './app-text';
import { OnboardingMotif } from './onboarding-motif';
import { OnboardingProgress } from './onboarding-progress';

interface OnboardingShellProps extends PropsWithChildren {
  currentStep: number;
  totalSteps: number;
  progressLabel: string;
  footer: ReactNode;
  onBack?: (() => void) | undefined;
}

export function OnboardingShell({
  children,
  currentStep,
  totalSteps,
  progressLabel,
  footer,
  onBack,
}: OnboardingShellProps) {
  return (
    <SafeAreaView
      className="flex-1 bg-onboarding-canvas"
      edges={['top', 'bottom']}
    >
      <OnboardingMotif />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="w-full max-w-[480px] flex-1 self-center px-6 pb-6 pt-4">
            <View className="min-h-[34px] flex-row items-start gap-4">
              {onBack === undefined ? (
                <View className="h-8 w-7" />
              ) : (
                <Pressable
                  accessibilityLabel="Go back"
                  accessibilityRole="button"
                  className="h-8 w-7 items-start justify-center active:opacity-60"
                  hitSlop={10}
                  onPress={onBack}
                >
                  <AppText
                    variant="heading"
                    className="text-onboarding-text leading-6"
                  >
                    {'<'}
                  </AppText>
                </Pressable>
              )}
              <OnboardingProgress
                currentStep={currentStep}
                totalSteps={totalSteps}
                label={progressLabel}
              />
            </View>
            <View className="mt-6 flex-1">{children}</View>
          </View>
        </ScrollView>
        <View className="border-t border-onboarding-line bg-onboarding-canvas/95 px-6 pb-3 pt-3">
          <View className="w-full max-w-[480px] self-center">{footer}</View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
