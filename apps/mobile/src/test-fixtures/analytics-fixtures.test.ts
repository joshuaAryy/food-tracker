import {
  canonicalInsightsResponseSchema,
  canonicalTrendResponseSchema,
} from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import {
  activeScrubTrendFixture,
  analyticsFixtureLayouts,
  complexInsightsFixture,
  longSavedViewFixture,
  simpleInsightsFixture,
  sparseVitaminDTrendFixture,
} from './analytics-fixtures';
import { analyticsStateFixtures } from './analytics-state-fixtures';

describe('Phase 17.5 analytics fidelity fixtures', () => {
  it('provides real-shaped Simple and Complex canonical overview responses', () => {
    expect(
      canonicalInsightsResponseSchema.safeParse(simpleInsightsFixture).success,
    ).toBe(true);
    expect(
      canonicalInsightsResponseSchema.safeParse(complexInsightsFixture).success,
    ).toBe(true);
    expect(Object.keys(simpleInsightsFixture.sections)).toEqual([
      'calories',
      'protein',
      'carbs',
      'fat',
      'macroComposition',
      'weight',
      'hydration',
      'loggingConsistency',
    ]);
    expect(
      Object.values(complexInsightsFixture.sections).every(
        (section) => section?.trackingMode === 'complex',
      ),
    ).toBe(true);
  });

  it('keeps unknown nutrient values as gaps without changing logging completeness', () => {
    const vitaminDPoints = sparseVitaminDTrendFixture.points;
    const unknownPoint = vitaminDPoints.find(
      (point) => point.kind === 'daily' && point.metricDataState === 'unknown',
    );

    expect(unknownPoint).toMatchObject({
      kind: 'daily',
      date: '2026-08-04',
      loggingDayState: 'complete',
      loggingDayPhase: 'closed',
      metricDataState: 'unknown',
      value: null,
    });
    expect(unknownPoint?.value).not.toBe(0);
    expect(
      canonicalTrendResponseSchema.safeParse(sparseVitaminDTrendFixture)
        .success,
    ).toBe(true);
  });

  it('represents the final state and layout fixtures without inventing analytics facts', () => {
    expect(analyticsFixtureLayouts).toEqual({
      standard390: { width: 390, fontScale: 1 },
      compact320: { width: 320, fontScale: 1 },
      largeType390: { width: 390, fontScale: 1.45 },
    });
    expect(analyticsStateFixtures.forecastUnavailable.trend.forecast).toEqual({
      kind: 'unavailable',
      reason: 'insufficient_coverage',
    });
    expect(
      analyticsStateFixtures.staleCached.report.sections.calories?.summary
        .average,
    ).toBe(1846);
    expect(analyticsStateFixtures.sectionFailure.failedSections).toEqual([
      'weight',
    ]);
    expect(analyticsStateFixtures.activeScrub).toMatchObject({
      selectedDate: '2026-08-01',
      selectedValue: 2490,
    });
    expect(
      activeScrubTrendFixture.points.find(
        (point) => point.kind === 'daily' && point.date === '2026-08-01',
      ),
    ).toMatchObject({ value: 2490 });
    expect(longSavedViewFixture.name.length).toBeGreaterThan(60);
  });

  it('keeps Simple fixtures free of Complex-only capabilities', () => {
    expect(simpleInsightsFixture.mode).toBe('simple');
    expect(analyticsStateFixtures.simpleCapabilities).toEqual({
      supportsCustomRange: false,
      supportsSavedViews: false,
      supportsTwoMetricComparison: false,
      supportsFullNutrientLibrary: false,
    });
    expect(analyticsStateFixtures.complexCapabilities).toEqual({
      supportsCustomRange: true,
      supportsSavedViews: true,
      supportsTwoMetricComparison: true,
      supportsFullNutrientLibrary: true,
    });
  });
});
