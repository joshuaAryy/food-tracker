import { Pressable, View } from 'react-native';
import { AppText } from '@/components/app-text';

export type InsightsTab = 'overview' | 'nutrients' | 'recommendations';

export function InsightsTabs({
  value,
  onChange,
}: {
  value: InsightsTab;
  onChange: (value: InsightsTab) => void;
}) {
  return (
    <View className="flex-row gap-1 rounded-[21px] bg-module p-1">
      {(
        [
          ['overview', 'Overview'],
          ['nutrients', 'Nutrients'],
          ['recommendations', 'Recommendations'],
        ] as const
      ).map(([key, label]) => (
        <Pressable
          key={key}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === key }}
          accessibilityLabel={label}
          className={`min-h-[34px] flex-1 items-center justify-center rounded-[17px] px-2 ${value === key ? 'bg-ink' : ''}`}
          onPress={() => onChange(key)}
        >
          <AppText
            variant="caption"
            className={value === key ? 'text-white' : 'text-muted'}
          >
            {label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
