import type {
  AnalyticsOverviewResultMap,
  CanonicalInsightsResponseV2,
} from '@food-tracker/shared';
import {
  analyticsReportResourceReducer,
  initialAnalyticsReportResource,
} from '@/lib/analytics/analytics-report-resource';
import { adaptCanonicalInsightsResponseV1 } from '@/lib/analytics/analytics-v1-adapter';
import { simpleInsightsFixture } from '@/test-fixtures/analytics-fixtures';
import { render, userEvent } from '@/test/render';
import { SimpleInsightsOverview } from '../simple-insights-overview';

const fetchedAt = '2026-08-11T12:00:00.000Z';

function failedOverview() {
  return {
    status: 'failed' as const,
    code: 'section_unavailable' as const,
    retryable: true as const,
  };
}

function overview(): AnalyticsOverviewResultMap {
  return {
    periodSummary: {
      status: 'available',
      fetchedAt,
      data: {
        resolvedRange: { startDate: '2026-08-01', endDate: '2026-08-07' },
        todaySoFar: {
          date: '2026-08-07',
          mealCount: 2,
          calories: { value: 1846, state: 'recorded' },
          protein: { value: 149, state: 'recorded' },
        },
        loggedDayCount: 2,
        eligibleLoggedDayCount: 2,
        eligibleTotalDayCount: 5,
        streak: { currentDays: 1, longestDays: 3 },
        currentDayPhase: 'in_progress',
        consistency: 40,
        interpretation: 'building',
      },
    },
    energy: {
      status: 'available',
      fetchedAt,
      data: {
        average: 1846,
        numericDayCount: 2,
        reference: {
          kind: 'range',
          lower: 1800,
          upper: 2200,
          unit: 'kcal',
          source: 'user',
        },
        withinRangeDayCount: 5,
        comparison: { direction: 'up', percentage: 3 },
        status: 'within_range',
      },
    },
    macros: {
      status: 'available',
      fetchedAt,
      data: {
        protein: { grams: 149, percentage: 24 },
        carbs: { grams: 269, percentage: 49 },
        fat: { grams: 49, percentage: 27 },
        status: 'recorded',
      },
    },
    nutrientHighlights: {
      status: 'available',
      fetchedAt,
      data: {
        highlights: [
          {
            metric: 'fiber',
            value: 28.9,
            unit: 'g',
            availability: 'recorded',
            reference: {
              kind: 'minimum',
              value: 30,
              unit: 'g',
              source: 'user',
            },
            status: 'below_minimum',
          },
          {
            metric: 'sodium',
            value: 2516,
            unit: 'mg',
            availability: 'recorded',
            reference: {
              kind: 'limit',
              value: 2300,
              unit: 'mg',
              source: 'user',
            },
            status: 'above_limit',
          },
          {
            metric: 'vitaminC',
            value: 96,
            unit: 'mg',
            availability: 'recorded',
            reference: {
              kind: 'minimum',
              value: 75,
              unit: 'mg',
              source: 'derived',
            },
            status: 'meets_minimum',
          },
        ],
      },
    },
    hydration: {
      status: 'available',
      fetchedAt,
      data: {
        today: '2026-08-07',
        timezone: 'America/New_York',
        total: 1630,
        goal: 2000,
        status: 'below_goal',
        trendSection: 'hydration',
      },
    },
    weight: {
      status: 'available',
      fetchedAt,
      data: {
        current: 129.4,
        availability: 'recorded',
        change: { periodDays: 30, value: 1.7, direction: 'up' },
        reference: { kind: 'target', value: 125, unit: 'lb', source: 'user' },
        goalPathStatus: 'moving_away',
        forecast: failedOverview(),
      },
    },
    loggingConsistency: {
      status: 'available',
      fetchedAt,
      data: {
        completeDayCount: 1,
        partialDayCount: 1,
        unloggedDayCount: 3,
        inProgressDayCount: 1,
        eligibleLoggedDayCount: 2,
        eligibleTotalDayCount: 5,
        streak: { currentDays: 1, longestDays: 3 },
        days: [
          {
            date: '2026-08-01',
            loggingDayState: 'complete',
            loggingDayPhase: 'closed',
          },
          {
            date: '2026-08-02',
            loggingDayState: 'partial',
            loggingDayPhase: 'closed',
          },
          {
            date: '2026-08-03',
            loggingDayState: 'unlogged',
            loggingDayPhase: 'closed',
          },
          {
            date: '2026-08-04',
            loggingDayState: 'unlogged',
            loggingDayPhase: 'closed',
          },
          {
            date: '2026-08-07',
            loggingDayState: 'unlogged',
            loggingDayPhase: 'in_progress',
          },
        ],
      },
    },
  };
}

function readySimpleResource() {
  const adapted = adaptCanonicalInsightsResponseV1(
    simpleInsightsFixture,
    fetchedAt,
  );
  if (adapted === null) throw new Error('Expected valid Simple fixture');
  const report: CanonicalInsightsResponseV2 = {
    ...adapted,
    overview: overview(),
  };
  return analyticsReportResourceReducer(
    analyticsReportResourceReducer(initialAnalyticsReportResource(), {
      type: 'load',
      requestId: 1,
    }),
    { type: 'commit', requestId: 1, report, updatedAt: 1 },
  );
}

function resourceWithUnavailableWeight() {
  const ready = readySimpleResource();
  const report = reportToResponse(ready);
  const loading = analyticsReportResourceReducer(
    initialAnalyticsReportResource(),
    {
      type: 'load',
      requestId: 2,
    },
  );
  return analyticsReportResourceReducer(loading, {
    type: 'commit',
    requestId: 2,
    report: {
      ...report,
      overview: { ...overview(), weight: failedOverview() },
    },
    updatedAt: 2,
  });
}

function reportToResponse(
  resource: ReturnType<typeof readySimpleResource>,
): CanonicalInsightsResponseV2 {
  return {
    contractVersion: 2,
    mode: resource.mode ?? 'simple',
    period: resource.period ?? 'week',
    sections: Object.fromEntries(
      Object.entries(resource.sections).flatMap(([key, section]) =>
        section?.data === null || section?.data === undefined
          ? []
          : [
              [
                key,
                { status: 'available' as const, data: section.data, fetchedAt },
              ],
            ],
      ),
    ),
    overview: overview(),
  };
}

describe('Simple Insights overview fidelity', () => {
  it('renders the approved hierarchy from backend overview facts', async () => {
    const screen = await render(
      <SimpleInsightsOverview
        resource={readySimpleResource()}
        onExploreTrends={jest.fn()}
        onLogWater={jest.fn()}
        onOverviewRetry={jest.fn()}
      />,
    );

    expect(
      screen
        .getAllByTestId(/simple-insights-section-/)
        .map((node) => node.props.testID),
    ).toEqual([
      'simple-insights-section-period-summary',
      'simple-insights-section-energy-balance',
      'simple-insights-section-macro-balance',
      'simple-insights-section-nutrient-highlights',
      'simple-insights-section-hydration',
      'simple-insights-section-weight-direction',
      'simple-insights-section-logging-consistency',
    ]);
    expect(screen.getByText('1,846 kcal')).toBeTruthy();
    expect(screen.getByText('Protein · 149 g')).toBeTruthy();
    expect(screen.getByText('2 of 5 eligible days logged')).toBeTruthy();
    expect(screen.getByText('1.63 L')).toBeTruthy();
    expect(screen.getByText('129.4 lb')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Explore all trends' }),
    ).toBeTruthy();
    expect(screen.queryByText('Explore every trend')).toBeNull();
    expect(screen.getByRole('button', { name: 'Log water' })).toBeTruthy();
  });

  it('keeps curated nutrient highlights informational and Complex actions absent', async () => {
    const onExploreTrends = jest.fn();
    const onLogWater = jest.fn();
    const screen = await render(
      <SimpleInsightsOverview
        resource={readySimpleResource()}
        onExploreTrends={onExploreTrends}
        onLogWater={onLogWater}
        onOverviewRetry={jest.fn()}
      />,
    );

    const user = userEvent.setup();
    await user.press(
      screen.getByRole('button', { name: 'Explore all trends' }),
    );
    await user.press(screen.getByRole('button', { name: 'Log water' }));

    expect(onExploreTrends).toHaveBeenCalledTimes(1);
    expect(onLogWater).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Fiber/i })).toBeNull();
    for (const action of [
      'Custom Range',
      'Saved views',
      'Compare metrics',
      'Configure',
      'Nutrient library',
    ]) {
      expect(screen.queryByText(action)).toBeNull();
    }
  });

  it('places Explore all trends before the report cards', async () => {
    const screen = await render(
      <SimpleInsightsOverview
        resource={readySimpleResource()}
        onExploreTrends={jest.fn()}
        onLogWater={jest.fn()}
        onOverviewRetry={jest.fn()}
      />,
    );
    const rendered = screen.toJSON();
    const testIDs: string[] = [];
    const collectTestIDs = (node: unknown): void => {
      if (node === null || typeof node !== 'object') return;
      const value = node as {
        props?: { testID?: string };
        children?: readonly unknown[];
      };
      if (value.props?.testID !== undefined) testIDs.push(value.props.testID);
      value.children?.forEach(collectTestIDs);
    };
    collectTestIDs(rendered);

    expect(testIDs.indexOf('simple-insights-explore')).toBeGreaterThanOrEqual(
      0,
    );
    expect(testIDs.indexOf('simple-insights-explore')).toBeLessThan(
      testIDs.indexOf('simple-insights-section-period-summary'),
    );
  });

  it('isolates a failed overview group and keeps healthy overview siblings visible', async () => {
    const resource = resourceWithUnavailableWeight();
    const onOverviewRetry = jest.fn();
    const screen = await render(
      <SimpleInsightsOverview
        resource={resource}
        onExploreTrends={jest.fn()}
        onLogWater={jest.fn()}
        onOverviewRetry={onOverviewRetry}
      />,
    );

    expect(screen.getByText('1,846 kcal')).toBeTruthy();
    expect(screen.getByText('Weight couldn’t load')).toBeTruthy();
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Retry weight' }));
    expect(onOverviewRetry).toHaveBeenCalledWith('weight');
  });
});
