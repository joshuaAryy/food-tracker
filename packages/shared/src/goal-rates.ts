export const RATE_STEP_LB_PER_WEEK = 0.05;
export const MIN_AUTOMATIC_RATE_LB_PER_WEEK = 0.25;

/** Normalize a supported rate through hundredths to avoid binary float drift. */
export function normalizeRateLbPerWeek(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isSelectableRateLbPerWeek(value: number): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  const normalized = normalizeRateLbPerWeek(value);
  return (
    normalized === value &&
    Math.round(normalized * 100) % Math.round(RATE_STEP_LB_PER_WEEK * 100) === 0
  );
}

export function floorRateToStep(value: number): number {
  return normalizeRateLbPerWeek(
    Math.floor((value * 100 + Number.EPSILON) / 5) * 0.05,
  );
}

export function roundRateToStep(value: number): number {
  return normalizeRateLbPerWeek(Math.round(value / 0.05) * 0.05);
}
