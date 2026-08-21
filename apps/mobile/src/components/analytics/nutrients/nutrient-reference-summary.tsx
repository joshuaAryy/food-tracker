import type { AnalyticsReference } from '@food-tracker/shared';
import { AppText } from '@/components/app-text';
import { formatMetricValue } from '@/lib/reporting-ui';

function referenceText(reference: AnalyticsReference): string {
  switch (reference.kind) {
    case 'target':
      return `Target · ${formatMetricValue(reference.value)} ${reference.unit}`;
    case 'minimum':
      return `Minimum · at least ${formatMetricValue(reference.value)} ${reference.unit}`;
    case 'limit':
      return `Limit · no more than ${formatMetricValue(reference.value)} ${reference.unit}`;
    case 'range':
      return `Range · ${formatMetricValue(reference.lower)}–${formatMetricValue(reference.upper)} ${reference.unit}`;
    case 'none':
      return 'Reference unavailable';
  }
}

export function NutrientReferenceSummary({
  reference,
}: {
  reference: AnalyticsReference;
}) {
  return (
    <AppText variant="caption" className="text-muted">
      {referenceText(reference)}
    </AppText>
  );
}
