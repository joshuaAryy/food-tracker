import { Pressable } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';

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
    <AppCard elevated className="gap-2 p-[18px]">
      <AppText variant="heading" className="text-[30px] leading-9">
        Hydration
      </AppText>
      <AppText variant="caption" className="text-muted">
        Explicitly logged drinks only ·{' '}
        {goal === null ? 'Goal unavailable' : `Goal ${goal} mL/day`}
      </AppText>
      <AppText variant="heading" className="text-[30px] leading-9 tabular-nums">
        {average === null ? 'Unknown' : `${(average / 1000).toFixed(1)} L`}
      </AppText>
      <AppText variant="caption" className="text-primary-dark">
        {average === null
          ? 'No recorded water days in this period.'
          : `Average across ${recordedDayCount} logged days`}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log water"
        className="min-h-11 self-start rounded-full bg-ink px-4 py-3"
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
    </AppCard>
  );
}
