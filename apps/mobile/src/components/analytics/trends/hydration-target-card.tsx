import { Pressable, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { formatMetricWithUnit } from '@/lib/reporting-ui';

export function HydrationTargetCard({
  goal,
  average,
  recordedDayCount,
  onLogWater,
  onOpenWaterLogger,
  quickAddPending = false,
  quickAddError = null,
  quickAddUndo,
}: {
  goal: number | null;
  average: number | null;
  recordedDayCount: number;
  onLogWater: () => void;
  onOpenWaterLogger?: (() => void) | undefined;
  quickAddPending?: boolean | undefined;
  quickAddError?: string | null | undefined;
  quickAddUndo?: (() => void) | undefined;
}) {
  return (
    <View className="gap-3">
      <View className="flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1 gap-1">
          <AppText
            variant="heading"
            className="text-[30px] leading-9 tabular-nums"
          >
            {formatMetricWithUnit(
              average === null ? null : average / 1000,
              'L',
              {
                maximumFractionDigits: 1,
              },
            )}
          </AppText>
          <AppText variant="caption" className="text-primary-dark">
            {average === null
              ? 'No recorded water days in this period.'
              : `Average across ${recordedDayCount} logged days`}
          </AppText>
        </View>
        <View className="items-end gap-1">
          <AppText variant="caption" className="text-muted">
            Goal
          </AppText>
          <AppText variant="label">
            {formatMetricWithUnit(goal === null ? null : goal / 1000, 'L', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
          </AppText>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log water"
        className="min-h-11 self-end rounded-full bg-ink px-6 py-3"
        onPress={onLogWater}
      >
        <AppText className="text-white">
          {quickAddPending ? 'Adding…' : '+ 250 mL'}
        </AppText>
      </Pressable>
      {quickAddUndo === undefined ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo water quick add"
          className="min-h-11 self-start justify-center"
          onPress={quickAddUndo}
        >
          <AppText
            variant="caption"
            className="font-semibold text-primary-dark"
          >
            Undo
          </AppText>
        </Pressable>
      )}
      {quickAddError === null ? null : (
        <AppText variant="caption" className="text-[#D72620]">
          {quickAddError}
        </AppText>
      )}
      {onOpenWaterLogger === undefined ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open other water amount"
          className="min-h-11 self-start justify-center"
          onPress={onOpenWaterLogger}
        >
          <AppText
            variant="caption"
            className="font-semibold text-primary-dark"
          >
            Other amount ›
          </AppText>
        </Pressable>
      )}
    </View>
  );
}
