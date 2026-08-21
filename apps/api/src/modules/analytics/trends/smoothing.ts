export function rollingAverageValues(
  values: readonly (number | null)[],
  eligible: readonly boolean[],
  window: number,
): (number | null)[] {
  return values.map((value, index) => {
    if (value === null || !eligible[index]) return null;
    const startIndex = Math.max(0, index - window + 1);
    const windowValues = values
      .slice(startIndex, index + 1)
      .flatMap((candidate, candidateOffset) =>
        candidate !== null && eligible[startIndex + candidateOffset]
          ? [candidate]
          : [],
      );
    return windowValues.length === 0
      ? null
      : windowValues.reduce((total, candidate) => total + candidate, 0) /
          windowValues.length;
  });
}

export function smoothingWindowForTrend({
  aggregation,
  periodDays,
}: {
  aggregation: 'daily' | 'weekly' | 'monthly';
  periodDays: number;
}): number {
  if (aggregation === 'daily') return periodDays <= 7 ? 3 : 7;
  if (aggregation === 'weekly') return 4;
  return 3;
}
