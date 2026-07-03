import { View } from 'react-native';
import { AppText } from './app-text';

interface OnboardingSupportProps {
  label: string;
  value: string;
}

export function OnboardingSupport({ label, value }: OnboardingSupportProps) {
  return (
    <View className="max-w-[330px] items-center gap-2">
      <AppText
        variant="caption"
        className="text-center text-onboarding-muted uppercase tracking-[1.5px]"
      >
        {label}
      </AppText>
      <AppText className="text-center text-onboarding-muted text-[15px] leading-6">
        {value}
      </AppText>
    </View>
  );
}
