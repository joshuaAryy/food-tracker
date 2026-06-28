import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { AppText } from './app-text';
import { OnboardingPanel } from './onboarding-panel';

interface OnboardingSummaryGroupProps extends PropsWithChildren {
  title: string;
}

export function OnboardingSummaryGroup({
  title,
  children,
}: OnboardingSummaryGroupProps) {
  return (
    <OnboardingPanel compact>
      <AppText
        variant="caption"
        className="text-onboarding-muted uppercase tracking-[1px]"
      >
        {title}
      </AppText>
      <View className="gap-2">{children}</View>
    </OnboardingPanel>
  );
}
