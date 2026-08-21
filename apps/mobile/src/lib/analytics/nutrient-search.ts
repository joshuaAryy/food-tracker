import {
  analyticsMetricsForMode,
  type AnalyticsMetricDefinition,
} from '@food-tracker/shared';

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function editDistance(left: string, right: string): number {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0] ?? 0;
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const saved = previous[column] ?? 0;
      previous[column] = Math.min(
        (previous[column] ?? 0) + 1,
        (previous[column - 1] ?? 0) + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      diagonal = saved;
    }
  }
  return previous[right.length] ?? 0;
}

function oneAdjacentTransposition(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  const differences = Array.from(
    { length: left.length },
    (_, index) => index,
  ).filter((index) => left[index] !== right[index]);
  if (differences.length !== 2) return false;
  const first = differences[0]!;
  const second = differences[1]!;
  return (
    second === first + 1 &&
    left[first] === right[second] &&
    left[second] === right[first]
  );
}

function scoreMetric(
  metric: AnalyticsMetricDefinition,
  query: string,
): number | null {
  if (query === '') return 0;
  const tokens = query.split(' ');
  const terms = [metric.displayName, ...metric.searchableTerms].map(normalize);
  const termTokens = terms.flatMap((term) => term.split(' '));
  if (
    !tokens.every((token) => termTokens.some((term) => term.startsWith(token)))
  ) {
    const typoMatch = tokens.every(
      (token) =>
        token.length >= 4 &&
        termTokens.some(
          (term) =>
            editDistance(token, term) <= 1 ||
            oneAdjacentTransposition(token, term),
        ),
    );
    if (!typoMatch) return null;
    return 3;
  }
  if (terms.some((term) => term === query)) return 0;
  if (terms.some((term) => term.startsWith(query))) return 1;
  return 2;
}

export function searchAnalyticsMetrics(
  query: string,
  metrics: readonly AnalyticsMetricDefinition[] = analyticsMetricsForMode(
    'complex',
  ),
): AnalyticsMetricDefinition[] {
  const normalizedQuery = normalize(query);
  return metrics
    .flatMap((metric) => {
      const score = scoreMetric(metric, normalizedQuery);
      return score === null ? [] : [{ metric, score }];
    })
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.metric.displayName.localeCompare(right.metric.displayName),
    )
    .map(({ metric }) => metric);
}
