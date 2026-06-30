import { View } from 'react-native';
import { AppText } from './app-text';

interface OnboardingSupportProps {
  label: string;
  value: string;
}

export function OnboardingSupport({ label, value }: OnboardingSupportProps) {
  return (
    <View className="max-w-[360px] gap-1">
      <AppText
        variant="caption"
        className="text-onboarding-muted uppercase tracking-[1px]"
      >
        {label}
      </AppText>
      <AppText className="text-onboarding-muted text-[14px] leading-5">
        {value}
      </AppText>
    </View>
  );
}
