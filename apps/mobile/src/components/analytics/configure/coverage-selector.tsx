import { Pressable, View } from 'react-native';
import type { AnalyticsCoverageFilter } from '@food-tracker/shared';
import { AppText } from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { SelectorRow } from './selector-row';

const options: readonly {
  value: AnalyticsCoverageFilter;
  label: string;
  description: string;
}[] = [
  {
    value: 'all_logged_days',
    label: 'All recorded days',
    description: 'Includes complete and partial recorded days',
  },
  {
    value: 'complete_and_partial',
    label: 'Complete + partial',
    description: 'Recommended balance of coverage and detail',
  },
  {
    value: 'complete_only',
    label: 'Complete days only',
    description: 'Only days with the required logging completeness',
  },
];

export function CoverageSelector({
  value,
  allowed,
  onSelect,
  onClose,
}: {
  value: AnalyticsCoverageFilter;
  allowed: readonly AnalyticsCoverageFilter[];
  onSelect: (value: AnalyticsCoverageFilter) => void;
  onClose: () => void;
}) {
  return (
    <View testID="coverage-selector" className="gap-5">
      <ScreenHeader
        title="Data coverage"
        subtitle="Choose which logging-quality days are allowed into this nutrition trend."
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done with Data coverage"
            className="min-h-11 justify-center"
            onPress={onClose}
          >
            <AppText variant="label">Done</AppText>
          </Pressable>
        }
      />
      <View className="gap-2">
        {options
          .filter((option) => allowed.includes(option.value))
          .map((option) => (
            <SelectorRow
              key={option.value}
              label={option.label}
              description={option.description}
              selected={value === option.value}
              onPress={() => onSelect(option.value)}
            />
          ))}
      </View>
    </View>
  );
}
