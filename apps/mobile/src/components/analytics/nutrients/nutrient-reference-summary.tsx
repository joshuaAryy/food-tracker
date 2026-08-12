import type { AnalyticsReference } from '@food-tracker/shared';
import { AppText } from '@/components/app-text';

function referenceText(reference: AnalyticsReference): string {
  switch (reference.kind) {
    case 'target':
      return `Target · ${reference.value} ${reference.unit}`;
    case 'minimum':
      return `Minimum · at least ${reference.value} ${reference.unit}`;
    case 'limit':
      return `Limit · no more than ${reference.value} ${reference.unit}`;
    case 'range':
      return `Range · ${reference.lower}–${reference.upper} ${reference.unit}`;
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
