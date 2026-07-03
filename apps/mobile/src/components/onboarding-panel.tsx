import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

interface OnboardingPanelProps extends PropsWithChildren {
  compact?: boolean;
}

export function OnboardingPanel({
  children,
  compact = false,
}: OnboardingPanelProps) {
  return <View className={compact ? 'gap-4' : 'gap-5'}>{children}</View>;
}
