import { clampScrubX } from './chart-geometry';

export interface ChartSelectablePoint {
  date: string;
  value: number | null;
}

export function selectedIndexForScrubX(
  position: number,
  pointCount: number,
  width: number,
): number {
  if (pointCount <= 1 || width <= 0) return 0;
  const clamped = clampScrubX(position, width);
  return Math.round((clamped / width) * (pointCount - 1));
}

export function selectionForSharedDate(
  primary: readonly ChartSelectablePoint[],
  comparison: readonly ChartSelectablePoint[],
  date: string,
): {
  date: string;
  primaryValue: number | null;
  comparisonValue: number | null;
} {
  return {
    date,
    primaryValue: primary.find((point) => point.date === date)?.value ?? null,
    comparisonValue:
      comparison.find((point) => point.date === date)?.value ?? null,
  };
}
