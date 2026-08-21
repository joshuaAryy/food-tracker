import { Pressable, View } from 'react-native';
import type { AnalyticsVisualization } from '@food-tracker/shared';
import { AppText } from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { SelectorRow } from './selector-row';

export function VisualizationSelector({
  value,
  allowed,
  onSelect,
  onClose,
}: {
  value: AnalyticsVisualization;
  allowed: readonly AnalyticsVisualization[];
  onSelect: (value: AnalyticsVisualization) => void;
  onClose: () => void;
}) {
  return (
    <View testID="visualization-selector" className="gap-5">
      <ScreenHeader
        title="Visualization"
        subtitle="Choose the approved chart treatment for this report."
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done with Visualization"
            className="min-h-11 justify-center"
            onPress={onClose}
          >
            <AppText variant="label">Done</AppText>
          </Pressable>
        }
      />
      <View className="gap-2">
        {allowed.map((visualization) => (
          <SelectorRow
            key={visualization}
            label={visualizationLabel(visualization)}
            description={visualizationDescription(visualization)}
            accessibilityLabel={`Use ${visualizationLabel(visualization)}`}
            selected={value === visualization}
            onPress={() => {
              onSelect(visualization);
              onClose();
            }}
          />
        ))}
      </View>
    </View>
  );
}

function visualizationLabel(value: AnalyticsVisualization): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function visualizationDescription(value: AnalyticsVisualization): string {
  switch (value) {
    case 'automatic':
      return 'Use the report’s canonical presentation.';
    case 'bars_with_trend':
      return 'Daily bars with the selected trend line.';
    case 'smoothed_line':
      return 'A smoothed line for directional reading.';
    case 'macro_donut':
      return 'Macro composition as a proportion view.';
    case 'stacked_macros':
      return 'Macro composition across the selected period.';
    case 'completeness_heatmap':
      return 'Logging-day completeness by date.';
    case 'meal_coverage_heatmap':
      return 'Meal coverage by date.';
    case 'linked_trends':
      return 'Related metrics on a shared time axis.';
    case 'dual_axis':
      return 'Two metrics with independent axes.';
    case 'reference_normalized':
      return 'Metrics normalized against their references.';
  }
}
