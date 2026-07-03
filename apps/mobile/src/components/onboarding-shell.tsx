import {
  useEffect,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLogo } from './app-logo';
import { AppText } from './app-text';
import { OnboardingProgress } from './onboarding-progress';

interface OnboardingShellProps extends PropsWithChildren {
  currentStep: number;
  totalSteps: number;
  progressLabel: string;
  footer: ReactNode;
  support?: ReactNode;
  onBack?: (() => void) | undefined;
}

export function OnboardingShell({
  children,
  currentStep,
  totalSteps,
  progressLabel,
  footer,
  support,
  onBack,
}: OnboardingShellProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaView
      className="flex-1 bg-onboarding-canvas"
      edges={['top', 'bottom']}
    >
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
          <View className="w-full max-w-[480px] flex-1 self-center px-7 pb-4 pt-5">
            <View className="min-h-[44px] flex-row items-center gap-4">
              {onBack === undefined ? (
                <View className="h-11 w-11 items-center justify-center">
                  <AppLogo size={30} tone="onboarding" />
                </View>
              ) : (
                <Pressable
                  accessibilityLabel="Go back"
                  accessibilityRole="button"
                  className="h-11 w-11 items-center justify-center rounded-full bg-module active:opacity-60"
                  hitSlop={10}
                  onPress={onBack}
                >
                  <AppText
                    variant="heading"
                    className="text-onboarding-muted leading-6"
                  >
                    {'‹'}
                  </AppText>
                </Pressable>
              )}
              <OnboardingProgress
                currentStep={currentStep}
                totalSteps={totalSteps}
                label={progressLabel}
              />
            </View>
            <View className="mt-8 flex-1">{children}</View>
            {support === undefined ? null : (
              <View
                className={`items-center ${
                  keyboardVisible ? 'pb-2 pt-4' : 'mt-auto pb-8 pt-10'
                }`}
              >
                {support}
              </View>
            )}
          </View>
        </ScrollView>
        <View className="bg-onboarding-canvas/95 px-7 pb-3 pt-2">
          <View className="w-full max-w-[480px] self-center">{footer}</View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
