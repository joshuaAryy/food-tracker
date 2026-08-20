import type { AnalyticsReference } from '@food-tracker/shared';
import { formatMetricValue } from '../reporting-ui';

export interface AxisDomain {
  minimum: number;
  maximum: number;
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function niceStep(rawStep: number): number {
  if (!positiveFinite(rawStep)) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const magnitude = 10 ** exponent;
  const normalized = rawStep / magnitude;
  const multiplier =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return multiplier * magnitude;
}

export function selectDateTickIndexes(
  dates: readonly string[],
  periodDays?: number,
): number[] {
  if (dates.length === 0) return [];
  const days = periodDays ?? dates.length;
  if (days <= 7) return dates.map((_, index) => index);

  const step =
    days <= 30 ? 7 : days <= 90 ? 30 : Math.max(1, Math.ceil(days / 5));
  const indexes: number[] = [];
  for (let index = 0; index < dates.length; index += step) {
    indexes.push(index);
  }
  const lastIndex = dates.length - 1;
  if (indexes.at(-1) !== lastIndex) indexes.push(lastIndex);
  return indexes;
}

export function numericAxisTicks(
  domain: AxisDomain,
  options: { targetCount?: number; includeZero?: boolean } = {},
): number[] {
  const targetCount = Math.max(2, Math.round(options.targetCount ?? 5));
  const lower = Math.min(domain.minimum, domain.maximum);
  const upper = Math.max(domain.minimum, domain.maximum);
  const minimum = options.includeZero ? Math.min(0, lower) : lower;
  const maximum = options.includeZero ? Math.max(0, upper) : upper;
  const range = maximum - minimum;
  const step = niceStep(range / (targetCount - 1));
  const start = Math.floor(minimum / step) * step;
  const end = Math.ceil(maximum / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 1000; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }
  return ticks;
}

export function axisReferenceLabel(
  reference: AnalyticsReference,
): string | null {
  if (reference.kind === 'none') return null;
  if (reference.kind === 'range') {
    return `Range · ${formatMetricValue(reference.lower)}–${formatMetricValue(reference.upper)} ${reference.unit}`;
  }
  const label =
    reference.kind === 'target'
      ? 'Target'
      : reference.kind === 'minimum'
        ? 'Minimum'
        : 'Limit';
  return `${label} · ${formatMetricValue(reference.value)} ${reference.unit}`;
}
