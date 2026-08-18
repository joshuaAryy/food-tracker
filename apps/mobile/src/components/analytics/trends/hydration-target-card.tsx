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
          <AppText variant="caption" className="text-[#337AC7]">
            {average === null
              ? 'No recorded water days in this period.'
              : `average across ${recordedDayCount} logged days`}
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
      <View
        testID="hydration-target-actions"
        className="flex-row items-center justify-end gap-3"
      >
        {onOpenWaterLogger === undefined ? null : (
          <Pressable
            testID="hydration-target-other-amount"
            accessibilityRole="button"
            accessibilityLabel="Open other water amount"
            className="min-h-10 flex-row items-center gap-2 rounded-[14px] bg-[#F7F7F4] px-3"
            onPress={onOpenWaterLogger}
          >
            <AppText variant="caption" className="font-semibold">
              Other amount
            </AppText>
            <AppText variant="heading" className="text-muted">
              ›
            </AppText>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log water"
          className="min-h-10 rounded-full bg-ink px-6 py-2"
          onPress={onLogWater}
        >
          <AppText variant="label" className="text-white">
            {quickAddPending ? 'Adding…' : '+ 250 mL'}
          </AppText>
        </Pressable>
      </View>
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
    </View>
  );
}
