import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/app-text';

export function ChartFrame({
  accessibilityLabel,
  children,
  selectedDescription,
}: {
  accessibilityLabel: string;
  children: ReactNode;
  selectedDescription?: string | undefined;
}) {
  return (
    <View accessible accessibilityLabel={accessibilityLabel} className="gap-2">
      {children}
      {selectedDescription === undefined ? null : (
        <AppText accessibilityLiveRegion="polite" variant="caption" muted>
          {selectedDescription}
        </AppText>
      )}
    </View>
  );
}
