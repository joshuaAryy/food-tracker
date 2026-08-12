import type { AnalyticsOverviewNutrientHighlight } from '@food-tracker/shared';

const VESSEL_COUNT = 8;

export function hydrationVesselFillLevels(
  total: number | null,
  goal: number,
  vesselCount = VESSEL_COUNT,
): (number | null)[] {
  if (total === null || goal <= 0 || vesselCount <= 0) {
    return Array.from({ length: vesselCount }, () => null);
  }
  const filledVessels = Math.max(0, total / (goal / vesselCount));
  return Array.from(
    { length: vesselCount },
    (_, index) =>
      Math.round(Math.max(0, Math.min(1, filledVessels - index)) * 100) / 100,
  );
}

type NutrientGauge = {
  fillPercent: number | null;
  primaryMarkerPercent: number | null;
  secondaryMarkerPercent: number | null;
};

export function nutrientGauge(
  highlight: AnalyticsOverviewNutrientHighlight,
): NutrientGauge {
  const { reference, value } = highlight;
  if (reference.kind === 'none' || value === null) {
    return {
      fillPercent: null,
      primaryMarkerPercent: null,
      secondaryMarkerPercent: null,
    };
  }
  const upper = reference.kind === 'range' ? reference.upper : reference.value;
  const scale = upper * 1.25;
  if (scale <= 0) {
    return {
      fillPercent: null,
      primaryMarkerPercent: null,
      secondaryMarkerPercent: null,
    };
  }
  const percent = (candidate: number) =>
    Math.max(0, Math.min(100, (candidate / scale) * 100));
  return {
    fillPercent: percent(value),
    primaryMarkerPercent: percent(
      reference.kind === 'range' ? reference.lower : upper,
    ),
    secondaryMarkerPercent:
      reference.kind === 'range' ? percent(reference.upper) : null,
  };
}
