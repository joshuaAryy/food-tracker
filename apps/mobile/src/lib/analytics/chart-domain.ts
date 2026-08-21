export interface ChartDomain {
  min: number;
  max: number;
}

export function fixedDomain(
  values: readonly (number | null)[],
  options: { includeZero: boolean },
): ChartDomain | null {
  const numericValues = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  if (numericValues.length === 0) return null;

  return {
    min: options.includeZero
      ? Math.min(0, ...numericValues)
      : Math.min(...numericValues),
    max: Math.max(...numericValues),
  };
}

export function normalizeToReference(
  value: number | null,
  reference: number | null,
): number | null {
  if (
    value === null ||
    reference === null ||
    !Number.isFinite(reference) ||
    reference <= 0
  ) {
    return null;
  }
  return value / reference;
}

export function selectedPointIndex(
  points: readonly { date: string; value: number | null }[],
  selectedDate: string,
): number {
  return points.findIndex((point) => point.date === selectedDate);
}
