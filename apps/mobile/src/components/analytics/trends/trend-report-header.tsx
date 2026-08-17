import { Pressable, View } from 'react-native';
import { AppText } from '@/components/app-text';

const defaultPeriods = [7, 30, 90] as const;

export function TrendReportHeader({
  metricName,
  subtitle,
  trackingMode,
  selectedPeriod,
  onSelectPeriod,
  onOpenCustomRange,
  periods = defaultPeriods,
  onConfigure,
  onSave,
  onBack,
  showPeriodControls = true,
  title = 'Trends',
  backLabel = '‹ Insights',
}: {
  metricName: string;
  subtitle?: string | undefined;
  trackingMode: 'simple' | 'complex';
  selectedPeriod: 7 | 30 | 90 | null;
  onSelectPeriod: (period: 7 | 30 | 90) => void;
  onOpenCustomRange?: (() => void) | undefined;
  periods?: readonly (7 | 30 | 90)[];
  onConfigure?: (() => void) | undefined;
  onSave?: (() => void) | undefined;
  onBack?: (() => void) | undefined;
  showPeriodControls?: boolean;
  title?: string;
  backLabel?: string;
}) {
  const complex = trackingMode === 'complex';
  return (
    <View testID="trend-report-header" className="gap-4">
      <View className="flex-row items-center justify-between">
        {onBack === undefined ? (
          <View className="w-16" />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Back from ${title}`}
            className="min-h-11 justify-center"
            onPress={onBack}
          >
            <AppText variant="caption">{backLabel}</AppText>
          </Pressable>
        )}
        <AppText variant="title">{title}</AppText>
        {complex && onSave !== undefined ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save"
            className="min-h-11 justify-center"
            onPress={onSave}
          >
            <AppText variant="caption">Save</AppText>
          </Pressable>
        ) : (
          <View className="w-16" />
        )}
      </View>
      <View className="flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1 gap-1">
          <AppText
            variant="heading"
            className="text-[30px] leading-9"
            numberOfLines={2}
          >
            {metricName}
          </AppText>
          {subtitle === undefined ? null : <AppText muted>{subtitle}</AppText>}
        </View>
        {complex && onConfigure !== undefined ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Configure"
            className="min-h-11 rounded-full border border-border px-4 py-3"
            onPress={onConfigure}
          >
            <AppText variant="caption">Configure</AppText>
          </Pressable>
        ) : null}
      </View>
      {!showPeriodControls ? null : (
        <View className="flex-row flex-wrap gap-2">
          {periods.map((period) => (
            <Pressable
              key={period}
              accessibilityRole="button"
              accessibilityState={{ selected: period === selectedPeriod }}
              accessibilityLabel={`${period}D`}
              className={`min-h-11 rounded-full border border-border px-4 py-3 ${period === selectedPeriod ? 'bg-ink' : 'bg-surface'}`}
              onPress={() => onSelectPeriod(period)}
            >
              <AppText
                className={
                  period === selectedPeriod ? 'text-white' : 'text-ink'
                }
              >
                {period}D
              </AppText>
            </Pressable>
          ))}
          {complex && onOpenCustomRange !== undefined ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Custom"
              className="min-h-11 rounded-full border border-border bg-surface px-4 py-3"
              onPress={onOpenCustomRange}
            >
              <AppText>Custom</AppText>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}
