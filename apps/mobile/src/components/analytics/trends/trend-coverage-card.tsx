import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';

export function TrendCoverageCard({
  logging,
  metric,
}: {
  logging: {
    complete: number;
    partial: number;
    unlogged: number;
    inProgress: number;
  };
  metric?:
    | {
        recorded: number;
        partial: number;
        unknown: number;
      }
    | undefined;
}) {
  return (
    <AppCard className="gap-1 bg-module p-4">
      <AppText variant="label">Data coverage</AppText>
      <AppText variant="caption" className="text-muted">
        {logging.complete} complete · {logging.partial} partial ·{' '}
        {logging.unlogged} unlogged
      </AppText>
      {logging.inProgress === 0 ? null : (
        <AppText variant="caption" className="text-primary-dark">
          Today is still in progress.
        </AppText>
      )}
      {metric === undefined ? null : (
        <AppText variant="caption" className="text-muted">
          {metric.recorded} recorded · {metric.partial} partial ·{' '}
          {metric.unknown} unknown metric days
        </AppText>
      )}
    </AppCard>
  );
}
