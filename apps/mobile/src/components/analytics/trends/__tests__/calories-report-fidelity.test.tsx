import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { CaloriesReport } from '../calories-report';
import { render, userEvent } from '@/test/render';

const trend: CanonicalTrendResponse = {
  timezone: 'America/New_York',
  trackingMode: 'simple',
  primaryMetric: 'calories',
  aggregation: 'daily',
  resolvedRange: { startDate: '2026-08-01', endDate: '2026-08-30' },
  firstEligibleDate: null,
  today: '2026-08-30',
  reference: {
    kind: 'range',
    lower: 1800,
    upper: 2200,
    unit: 'kcal',
    source: 'user',
  },
  interpretation: { kind: 'within_range', message: 'Within your usual range.' },
  relatedMetrics: [],
  points: [
    {
      kind: 'daily',
      date: '2026-08-29',
      loggingDayState: 'complete',
      loggingDayPhase: 'closed',
      metricDataState: 'recorded',
      value: 1846,
      foodLogCount: 3,
      metricRecordedLogCount: 3,
      metricUnknownLogCount: 0,
    },
  ],
  rollingTrend: { window: 3, values: [1846] },
  summary: { numericDayCount: 1, average: 1846 },
  loggingSummary: {
    complete: 1,
    partial: 0,
    unlogged: 0,
    inProgress: 0,
    consistency: 100,
    currentDayPhase: 'closed',
    mealCoverage: [],
  },
  calorieRangeSummary: {
    insideRangeDayCount: 1,
    eligibleDayCount: 1,
    status: 'insufficient_data',
  },
};

describe('Calories trend report fidelity', () => {
  it('keeps the approved summary/chart/coverage composition and Simple boundary', async () => {
    const screen = await render(
      <CaloriesReport
        trend={trend}
        width={390}
        simple
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
        onOpenContributors={jest.fn()}
      />,
    );

    expect(screen.getByText('1,846 kcal')).toBeTruthy();
    expect(screen.getByText(/Coverage: 1 complete/)).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Open custom range' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'View food contributors' }),
    ).toBeNull();
    await userEvent.setup().press(screen.getByRole('button', { name: '7D' }));
  });

  it('separates pale daily calorie columns from the dark derived trend', async () => {
    const dailyPoints: CanonicalTrendResponse['points'] = [
      {
        kind: 'daily',
        date: '2026-08-29',
        loggingDayState: 'complete',
        loggingDayPhase: 'closed',
        metricDataState: 'recorded',
        value: 1846,
        foodLogCount: 3,
        metricRecordedLogCount: 3,
        metricUnknownLogCount: 0,
      },
      {
        kind: 'daily',
        date: '2026-08-30',
        loggingDayState: 'unlogged',
        loggingDayPhase: 'closed',
        metricDataState: null,
        value: null,
        foodLogCount: 0,
        metricRecordedLogCount: 0,
        metricUnknownLogCount: 0,
      },
    ];
    const screen = await render(
      <CaloriesReport
        trend={{
          ...trend,
          points: dailyPoints,
          rollingTrend: { window: 3, values: [1846, null] },
        }}
        width={390}
        simple
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
        onOpenContributors={jest.fn()}
      />,
    );

    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('"payload":4294178031');
    expect(tree).toContain('Selected values remain gaps');
    expect(tree).toContain('"payload":4279111182');
  });
});
