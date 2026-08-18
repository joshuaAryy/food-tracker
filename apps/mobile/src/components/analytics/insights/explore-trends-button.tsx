import { Pressable } from 'react-native';
import { AppText } from '@/components/app-text';

export function ExploreTrendsButton({
  onPress,
  compact = false,
  testID = 'insights-explore',
}: {
  onPress: () => void;
  compact?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Explore all trends"
      className={`flex-row items-center justify-between rounded-[12px] bg-module-muted px-4 active:opacity-70 ${compact ? 'min-h-10' : 'min-h-[52px]'}`}
      onPress={onPress}
    >
      <AppText variant={compact ? 'caption' : 'label'}>
        Explore all trends
      </AppText>
      <AppText variant="label" className="text-muted">
        ›
      </AppText>
    </Pressable>
  );
}
