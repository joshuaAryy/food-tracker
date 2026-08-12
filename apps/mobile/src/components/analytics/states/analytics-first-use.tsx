import { View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';

export function AnalyticsFirstUse({
  mealCount,
  calories,
  proteinGrams,
  loggedDays,
  requiredDays,
  currentDayPhase,
  onExplore,
}: {
  mealCount: number;
  calories: number | null;
  proteinGrams: number | null;
  loggedDays: number;
  requiredDays: number;
  currentDayPhase: 'closed' | 'in_progress';
  onExplore: () => void;
}) {
  const progress = Math.max(0, Math.min(1, loggedDays / requiredDays));
  return (
    <View testID="analytics-first-use" className="gap-5">
      <AppText variant="title">Today so far</AppText>
      <AppText variant="caption" className="-mt-3 text-muted">
        Today · {currentDayPhase === 'in_progress' ? 'Early logging' : 'Closed'}
      </AppText>
      <AppCard elevated className="gap-4 p-[18px]">
        <View className="flex-row gap-4">
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="caption" className="text-muted">
              Logged
            </AppText>
            <AppText variant="number">
              {mealCount} {mealCount === 1 ? 'meal' : 'meals'}
            </AppText>
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="caption" className="text-muted">
              Energy (kcal)
            </AppText>
            <AppText variant="number">
              {calories === null ? '—' : calories.toLocaleString('en-US')}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" className="text-muted">
          {proteinGrams === null
            ? 'Protein unavailable'
            : `${proteinGrams} g protein`}{' '}
          · current recorded totals
        </AppText>
      </AppCard>
      <AppButton
        variant="secondary"
        accessibilityLabel="Explore all trends"
        className="min-h-11 flex-row items-center justify-between rounded-[15px] px-4"
        onPress={onExplore}
      >
        <AppText variant="label">Explore all trends</AppText>
        <AppText variant="heading" className="text-[22px] leading-7">
          ›
        </AppText>
      </AppButton>
      <View className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <AppText variant="heading" className="text-[20px] leading-7">
            Keep logging to unlock trends
          </AppText>
          <AppText variant="label" className="text-primary-dark">
            {loggedDays} / {requiredDays} days
          </AppText>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-border">
          <View
            className="h-2 rounded-full bg-primary"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </View>
        <AppText variant="caption" className="text-muted">
          {loggedDays} of {requiredDays} days with usable logging. Your current
          totals stay visible while trends wait for enough history to be useful.
        </AppText>
      </View>
      <AppCard className="gap-2 p-4">
        <AppText variant="caption" className="font-bold uppercase text-muted">
          Available now
        </AppText>
        <AppText variant="body">
          • Today’s energy and macros{`\n`}• Hydration logged today{`\n`}•
          Current weight if recorded
        </AppText>
      </AppCard>
    </View>
  );
}
