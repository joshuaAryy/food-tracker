import { describe, expect, it } from 'vitest';
import {
  selectDeterministicForecast,
  type ForecastObservation,
} from '../src/modules/analytics/trends/forecast.js';
import { forecastPolicyWith } from '../src/modules/analytics/trends/forecast-policy.js';

const policy = forecastPolicyWith({
  minElapsedDays: 8,
  minUsableDays: 6,
  minModelImprovement: 0.05,
  maxNormalizedMae: 1,
  maxIntervalWidth: 10,
});

function observations(values: readonly number[]): ForecastObservation[] {
  return values.map((value, index) => ({
    date: `2026-08-${String(index + 1).padStart(2, '0')}`,
    value,
  }));
}

describe('deterministic analytics forecasts', () => {
  it('returns unavailable before policy coverage gates are met', () => {
    expect(
      selectDeterministicForecast(observations([1, 2, 3]), policy),
    ).toMatchObject({
      kind: 'unavailable',
      reason: 'insufficient_coverage',
    });
  });

  it('requires the policy elapsed history even when repeated observations meet the usable count', () => {
    const irregular = [100, 101, 99, 100, 101, 99, 100, 101].map(
      (value, index) => ({
        date: `2026-08-0${Math.floor(index / 2) + 1}`,
        value,
      }),
    );

    expect(selectDeterministicForecast(irregular, policy)).toEqual({
      kind: 'unavailable',
      reason: 'insufficient_coverage',
    });
  });

  it('uses rolling-origin diagnostics and prefers the simple baseline without meaningful improvement', () => {
    const result = selectDeterministicForecast(
      observations([100, 101, 99, 100, 101, 99, 100, 101]),
      policy,
    );
    expect(result).toMatchObject({
      kind: 'available',
      model: 'mean',
      horizonDays: 7,
    });
    if (result.kind === 'available') {
      expect(result.points).toHaveLength(7);
      expect(result.diagnostics.selectedMae).toBeLessThanOrEqual(
        result.diagnostics.baselineMae,
      );
    }
  });

  it('uses a justified trend only when rolling-origin error improves and widens uncertainty', () => {
    const result = selectDeterministicForecast(
      observations([10, 12, 14, 16, 18, 20, 22, 24, 26, 28]),
      policy,
    );
    expect(result).toMatchObject({ kind: 'available', model: 'linear_trend' });
    if (result.kind === 'available') {
      expect(result.points[0]?.value).toBeGreaterThan(28);
      expect(result.points[6]?.upper).toBeGreaterThan(
        result.points[0]?.upper ?? 0,
      );
    }
  });
});
