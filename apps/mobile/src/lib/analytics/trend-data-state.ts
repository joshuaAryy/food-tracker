import type { AnalyticsReference } from '@food-tracker/shared';

export function metricCoverageMessage(counts: {
  recorded: number;
  partial: number;
  unknown: number;
}): string | null {
  if (counts.unknown > 0 || counts.partial > 0) {
    return 'Some logged foods are missing this nutrient; unknown values remain gaps.';
  }
  return counts.recorded > 0 ? 'Recorded nutrient data is complete.' : null;
}

export function referenceMessage(reference: AnalyticsReference): string | null {
  if (reference.kind === 'none') return null;
  if (reference.kind === 'range') {
    return `Accepted range: ${reference.lower}–${reference.upper} ${reference.unit}`;
  }
  const label =
    reference.kind === 'target'
      ? 'Target'
      : reference.kind === 'minimum'
        ? 'Minimum'
        : 'Limit';
  return `${label}: ${reference.value} ${reference.unit}`;
}
