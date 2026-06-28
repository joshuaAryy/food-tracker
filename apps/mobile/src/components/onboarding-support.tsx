import { View } from 'react-native';
import { AppText } from './app-text';

interface OnboardingSupportProps {
  label: string;
  value: string;
}

export function OnboardingSupport({ label, value }: OnboardingSupportProps) {
  return (
    <View className="px-1 pt-1">
      <AppText
        variant="caption"
        className="text-onboarding-muted uppercase tracking-[1px]"
      >
        {label}
      </AppText>
      <AppText className="mt-1 text-onboarding-muted leading-5">
        {value}
      </AppText>
    </View>
  );
}
