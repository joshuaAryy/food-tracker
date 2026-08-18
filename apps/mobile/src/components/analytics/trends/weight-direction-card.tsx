import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppText } from '@/components/app-text';

export function WeightDirectionCard({
  facts,
}: {
  facts: CanonicalTrendResponse['weightFacts'];
}) {
  const message =
    facts === undefined || facts.goalPath === 'unknown'
      ? 'Keep recording authoritative weights to establish direction.'
      : facts.goalPath === 'moving_toward'
        ? 'Your smoothed trend is moving gradually toward your goal.'
        : facts.goalPath === 'moving_away'
          ? 'Your weight trend is moving away from your goal.'
          : facts.goalPath === 'at_goal'
            ? 'Your current weight is at your goal.'
            : 'A weight goal is not configured.';
  return (
    <View className="gap-2 border-b border-border pb-6">
      <AppText variant="label">{message}</AppText>
      <AppText variant="caption" className="text-muted">
        Raw weigh-ins remain available without making daily fluctuations the
        primary signal.
      </AppText>
    </View>
  );
}
