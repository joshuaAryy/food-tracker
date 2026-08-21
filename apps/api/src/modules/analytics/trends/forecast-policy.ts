import type {
  LoggingDayPhase,
  LoggingDayState,
  MetricDataState,
} from '@food-tracker/shared';

/**
 * Initial engineering policy values. Backtesting diagnostics, not UI copy,
 * determine whether these should change in a later implementation increment.
 */
export interface AnalyticsForecastPolicy {
  version: string;
  horizonDays: number;
  minElapsedDays: number;
  minUsableDays: number;
  minModelImprovement: number;
  maxNormalizedMae: number;
  maxIntervalWidth: number;
}

export const DEFAULT_ANALYTICS_FORECAST_POLICY: AnalyticsForecastPolicy = {
  version: 'phase-17.5-v1',
  horizonDays: 7,
  minElapsedDays: 42,
  minUsableDays: 28,
  minModelImprovement: 0.05,
  maxNormalizedMae: 0.25,
  maxIntervalWidth: 0.3,
};

export function forecastPolicyWith(
  overrides: Partial<AnalyticsForecastPolicy>,
): AnalyticsForecastPolicy {
  return { ...DEFAULT_ANALYTICS_FORECAST_POLICY, ...overrides };
}

export interface CalorieForecastCandidatePoint {
  date: string;
  value: number | null;
  loggingDayState: LoggingDayState;
  loggingDayPhase: LoggingDayPhase;
  metricDataState: MetricDataState | null;
}

/** Partial or in-progress logging remains diagnostic coverage, never fit data. */
export function eligibleCalorieForecastPoints(
  points: readonly CalorieForecastCandidatePoint[],
): { date: string; value: number }[] {
  return points.flatMap((point) =>
    point.loggingDayState === 'complete' &&
    point.loggingDayPhase === 'closed' &&
    point.metricDataState === 'recorded' &&
    point.value !== null &&
    Number.isFinite(point.value)
      ? [{ date: point.date, value: point.value }]
      : [],
  );
}
