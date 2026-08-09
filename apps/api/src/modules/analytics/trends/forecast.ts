import type { AnalyticsForecastPolicy } from './forecast-policy.js';

export interface ForecastObservation {
  date: string;
  value: number;
}

export interface ForecastPoint {
  value: number;
  lower: number;
  upper: number;
}

export type DeterministicForecast =
  | { kind: 'unavailable'; reason: 'insufficient_coverage' | 'unstable' }
  | {
      kind: 'available';
      model: 'mean' | 'linear_trend';
      horizonDays: number;
      points: ForecastPoint[];
      diagnostics: {
        baselineMae: number;
        trendMae: number;
        selectedMae: number;
        residualMae: number;
      };
    };

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function linearPrediction(values: readonly number[], nextIndex: number): number {
  const count = values.length;
  const meanX = (count - 1) / 2;
  const meanY = mean(values);
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - meanX) * (value - meanY);
    denominator += (index - meanX) ** 2;
  });
  const slope = denominator === 0 ? 0 : numerator / denominator;
  return meanY + slope * (nextIndex - meanX);
}

function rollingMae(
  values: readonly number[],
  predictor: (history: readonly number[]) => number,
): number {
  const errors = values.slice(2).map((actual, offset) => {
    const history = values.slice(0, offset + 2);
    return Math.abs(actual - predictor(history));
  });
  return errors.length === 0 ? Number.POSITIVE_INFINITY : mean(errors);
}

function elapsedObservationDays(observations: readonly ForecastObservation[]): number {
  const timestamps = observations
    .map((observation) => Date.parse(`${observation.date}T00:00:00.000Z`))
    .filter(Number.isFinite);
  if (timestamps.length === 0) return 0;
  return (
    Math.floor((Math.max(...timestamps) - Math.min(...timestamps)) / 86_400_000) +
    1
  );
}

export function selectDeterministicForecast(
  observations: readonly ForecastObservation[],
  policy: AnalyticsForecastPolicy,
): DeterministicForecast {
  if (
    observations.length < policy.minUsableDays ||
    elapsedObservationDays(observations) < policy.minElapsedDays
  ) {
    return { kind: 'unavailable', reason: 'insufficient_coverage' };
  }
  const values = observations.map((point) => point.value);
  const baselineMae = rollingMae(values, (history) => mean(history));
  const trendMae = rollingMae(values, (history) =>
    linearPrediction(history, history.length),
  );
  const useTrend =
    trendMae < baselineMae * (1 - policy.minModelImprovement);
  const selectedMae = useTrend ? trendMae : baselineMae;
  const scale = Math.max(1, Math.abs(mean(values)));
  if (!Number.isFinite(selectedMae) || selectedMae / scale > policy.maxNormalizedMae) {
    return { kind: 'unavailable', reason: 'unstable' };
  }
  const model = useTrend ? 'linear_trend' : 'mean';
  const forecastValues = Array.from({ length: policy.horizonDays }, (_, index) =>
    model === 'linear_trend'
      ? linearPrediction(values, values.length + index)
      : mean(values),
  );
  const intervalBase = Math.max(selectedMae, Number.EPSILON);
  const finalWidth = (intervalBase * policy.horizonDays) / scale;
  if (finalWidth > policy.maxIntervalWidth) {
    return { kind: 'unavailable', reason: 'unstable' };
  }
  return {
    kind: 'available',
    model,
    horizonDays: policy.horizonDays,
    points: forecastValues.map((value, index) => {
      const width = intervalBase * (1 + index / policy.horizonDays);
      return { value, lower: value - width, upper: value + width };
    }),
    diagnostics: {
      baselineMae,
      trendMae,
      selectedMae,
      residualMae: intervalBase,
    },
  };
}
