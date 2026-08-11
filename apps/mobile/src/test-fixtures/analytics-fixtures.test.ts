import {
  canonicalInsightsResponseSchema,
  canonicalTrendResponseSchema,
} from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import {
  activeScrubTrendFixture,
  caloriesTrendFixture,
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
      date: '2026-07-06',
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

  it('represents final state fixtures without inventing analytics facts', () => {
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
      selectedDate: '2026-07-29',
      selectedValue: 2490,
    });
    expect(
      activeScrubTrendFixture.points.find(
        (point) => point.kind === 'daily' && point.date === '2026-07-29',
      ),
    ).toMatchObject({ value: 2490 });
    expect(longSavedViewFixture.name.length).toBeGreaterThan(60);
  });

  it('encodes the exact 30-day Calories reference period and canonical day states', () => {
    const dailyPoints = caloriesTrendFixture.points.filter(
      (point) => point.kind === 'daily',
    );
    const stateCounts = dailyPoints.reduce(
      (counts, point) => ({
        ...counts,
        [point.loggingDayState]: counts[point.loggingDayState] + 1,
      }),
      { complete: 0, partial: 0, unlogged: 0 },
    );

    expect(caloriesTrendFixture.resolvedRange).toEqual({
      startDate: '2026-07-06',
      endDate: '2026-08-04',
    });
    expect(caloriesTrendFixture.today).toBe('2026-08-04');
    expect(dailyPoints).toHaveLength(27);
    expect(stateCounts).toEqual({ complete: 21, partial: 3, unlogged: 3 });
    expect(
      dailyPoints.find((point) => point.date === caloriesTrendFixture.today),
    ).toMatchObject({
      loggingDayState: 'unlogged',
      loggingDayPhase: 'in_progress',
      metricDataState: null,
      value: null,
    });
    const numericValues = dailyPoints
      .map((point) => point.value)
      .filter((value): value is number => value !== null);
    expect(numericValues).toHaveLength(24);
    expect(
      numericValues.reduce((total, value) => total + value, 0) /
        numericValues.length,
    ).toBe(1846);
    const usualRange = caloriesTrendFixture.reference;
    expect(usualRange.kind).toBe('range');
    if (usualRange.kind !== 'range') throw new Error('Expected a true range');
    expect(
      numericValues.filter(
        (value) => value >= usualRange.lower && value <= usualRange.upper,
      ),
    ).toHaveLength(22);
    expect(
      numericValues.filter(
        (value) => value < usualRange.lower || value > usualRange.upper,
      ),
    ).toHaveLength(2);
    expect(caloriesTrendFixture.summary).toEqual({
      numericDayCount: 24,
      average: 1846,
    });
    expect(
      dailyPoints.find((point) => point.date === '2026-07-29'),
    ).toMatchObject({
      loggingDayState: 'complete',
      loggingDayPhase: 'closed',
      metricDataState: 'recorded',
      value: 2490,
    });
    expect(
      canonicalTrendResponseSchema.safeParse(caloriesTrendFixture).success,
    ).toBe(true);
  });

  it("encodes today's first-use meal totals and the exact 2-of-7 unlock facts", () => {
    expect(analyticsStateFixtures.firstUse).toMatchObject({
      nodeId: '495:21',
      today: {
        mealCount: 1,
        calories: 612,
        proteinGrams: 38,
      },
      unlock: { loggedDays: 2, requiredDays: 7 },
    });
    expect(
      analyticsStateFixtures.firstUse.report.sections.calories?.summary,
    ).toEqual({ numericDayCount: 1, average: 612 });
    expect(
      analyticsStateFixtures.firstUse.report.sections.protein?.summary,
    ).toEqual({ numericDayCount: 1, average: 38 });
    expect(
      analyticsStateFixtures.firstUse.report.sections.calories?.reference,
    ).toEqual({
      kind: 'none',
      unit: 'kcal',
      reason: 'not_configured',
    });
    expect(
      analyticsStateFixtures.firstUse.report.sections.protein?.reference,
    ).toEqual({
      kind: 'none',
      unit: 'g',
      reason: 'not_configured',
    });
    expect(
      canonicalInsightsResponseSchema.safeParse(
        analyticsStateFixtures.firstUse.report,
      ).success,
    ).toBe(true);
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
