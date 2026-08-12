import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { AppCard } from '@/components/app-card';
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
        ? 'Your weight trend is moving toward your goal.'
        : facts.goalPath === 'moving_away'
          ? 'Your weight trend is moving away from your goal.'
          : facts.goalPath === 'at_goal'
            ? 'Your current weight is at your goal.'
            : 'A weight goal is not configured.';
  return (
    <AppCard className="gap-1 bg-module p-4">
      <AppText variant="label">Direction and goal path</AppText>
      <AppText variant="caption" className="text-muted">
        {message}
      </AppText>
      {facts?.change === null || facts?.change === undefined ? null : (
        <AppText variant="caption" className="text-muted">
          {facts.change > 0 ? '+' : ''}
          {facts.change.toFixed(1)} lb over the selected period.
        </AppText>
      )}
    </AppCard>
  );
}
