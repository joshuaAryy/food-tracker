import type { AnalyticsReference } from '@food-tracker/shared';

export type AnalyticsReferenceInterpretation =
  | 'below_range'
  | 'above_range'
  | 'within_range'
  | 'below_minimum'
  | 'meets_minimum'
  | 'above_limit'
  | 'within_limit';

export function interpretAnalyticsReference(
  average: number | null,
  reference: AnalyticsReference,
): { kind: AnalyticsReferenceInterpretation; message: string } | null {
  if (average === null || reference.kind === 'none' || reference.kind === 'target') {
    return null;
  }
  if (reference.kind === 'range') {
    if (average < reference.lower) {
      return { kind: 'below_range', message: 'Recorded average is below the configured range.' };
    }
    if (average > reference.upper) {
      return { kind: 'above_range', message: 'Recorded average is above the configured range.' };
    }
    return { kind: 'within_range', message: 'Recorded average is within the configured range.' };
  }
  if (reference.kind === 'minimum') {
    return average < reference.value
      ? { kind: 'below_minimum', message: 'Recorded average is below the configured minimum.' }
      : { kind: 'meets_minimum', message: 'Recorded average meets the configured minimum.' };
  }
  return average > reference.value
    ? { kind: 'above_limit', message: 'Recorded average is above the configured limit.' }
    : { kind: 'within_limit', message: 'Recorded average is within the configured limit.' };
}
