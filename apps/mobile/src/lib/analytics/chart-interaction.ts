import { clampScrubX } from './chart-geometry';

export interface ChartSelectablePoint {
  date: string;
  value: number | null;
}

export function selectedIndexForScrubX(
  position: number,
  pointCount: number,
  width: number,
): number | null {
  if (pointCount <= 0) return null;
  if (pointCount === 1 || width <= 0) return 0;
  const clamped = clampScrubX(position, width);
  return Math.round((clamped / width) * (pointCount - 1));
}

/** Prevents haptic feedback while a scrub remains on the same underlying day. */
export function shouldAnnounceSelectionChange(
  previousIndex: number | null,
  nextIndex: number,
): boolean {
  return previousIndex !== nextIndex;
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
