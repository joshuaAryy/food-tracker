import { Pressable, View } from 'react-native';
import { AppText } from '@/components/app-text';

export function TrendPeriodPills({
  selectedPeriod,
  onSelect,
  simple,
  onOpenCustomRange,
  periods = [7, 30, 90],
  includeCustom = true,
}: {
  selectedPeriod: 7 | 30 | 90 | null;
  onSelect: (period: 7 | 30 | 90) => void;
  simple: boolean;
  onOpenCustomRange?: () => void;
  periods?: readonly (7 | 30 | 90)[];
  includeCustom?: boolean;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {periods.map((period) => (
        <Pressable
          key={period}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedPeriod === period }}
          accessibilityLabel={`${period}D`}
          className={`min-h-11 rounded-full border border-line px-4 py-3 ${selectedPeriod === period ? 'bg-ink' : 'bg-white'}`}
          onPress={() => onSelect(period)}
        >
          <AppText
            className={selectedPeriod === period ? 'text-white' : 'text-ink'}
          >
            {period}D
          </AppText>
        </Pressable>
      ))}
      {simple || !includeCustom || onOpenCustomRange === undefined ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Custom"
          className="min-h-11 rounded-full border border-line bg-white px-4 py-3"
          onPress={onOpenCustomRange}
        >
          <AppText>Custom</AppText>
        </Pressable>
      )}
    </View>
  );
}
