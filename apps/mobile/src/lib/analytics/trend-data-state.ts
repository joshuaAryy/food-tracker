import type { AnalyticsReference } from '@food-tracker/shared';
import { formatMetricValue } from '../reporting-ui';

function formatReferenceValue(value: number): string {
  return formatMetricValue(value, {
    maximumFractionDigits: 1,
    useGrouping: false,
  });
}

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
    return `Accepted range: ${formatReferenceValue(reference.lower)}–${formatReferenceValue(reference.upper)} ${reference.unit}`;
  }
  const label =
    reference.kind === 'target'
      ? 'Target'
      : reference.kind === 'minimum'
        ? 'Minimum'
        : 'Limit';
  return `${label}: ${formatReferenceValue(reference.value)} ${reference.unit}`;
}
