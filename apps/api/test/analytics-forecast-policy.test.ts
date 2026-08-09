import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ANALYTICS_FORECAST_POLICY,
  eligibleCalorieForecastPoints,
  forecastPolicyWith,
} from '../src/modules/analytics/trends/forecast-policy.js';

describe('analytics forecast policy', () => {
  it('keeps initial thresholds centralized and overrideable for backtesting', () => {
    expect(DEFAULT_ANALYTICS_FORECAST_POLICY).toMatchObject({
      version: 'phase-17.5-v1',
      horizonDays: 7,
    });
    expect(forecastPolicyWith({ minUsableDays: 10 }).minUsableDays).toBe(10);
  });

  it('uses only closed logging-complete calorie-recorded days for calorie fitting', () => {
    expect(
      eligibleCalorieForecastPoints([
        {
          date: '2026-08-01',
          value: 2100,
          loggingDayState: 'complete',
          loggingDayPhase: 'closed',
          metricDataState: 'recorded',
        },
        {
          date: '2026-08-02',
          value: 1800,
          loggingDayState: 'partial',
          loggingDayPhase: 'closed',
          metricDataState: 'recorded',
        },
        {
          date: '2026-08-03',
          value: 2000,
          loggingDayState: 'complete',
          loggingDayPhase: 'in_progress',
          metricDataState: 'recorded',
        },
        {
          date: '2026-08-04',
          value: null,
          loggingDayState: 'complete',
          loggingDayPhase: 'closed',
          metricDataState: 'unknown',
        },
      ]),
    ).toEqual([{ date: '2026-08-01', value: 2100 }]);
  });
});
