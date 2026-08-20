import { render, userEvent, waitFor } from '../../../test/render';
import { api } from '../../../lib/api-client';
import {
  ANALYTICS_INSIGHTS_SECTION_KEYS,
  type AnalyticsOverviewResultMap,
} from '@food-tracker/shared';
import {
  complexInsightsFixture,
  simpleInsightsFixture,
} from '../../../test-fixtures/analytics-fixtures';
import { analyticsStateFixtures } from '../../../test-fixtures/analytics-state-fixtures';
import InsightsScreen from '../insights';
import { adaptCanonicalInsightsResponseWithOverview } from '@/lib/analytics/analytics-v1-adapter';

const mockCacheWrite = jest.fn();
let mockDataVersion = 0;

const fetchedAt = '2026-08-11T12:00:00.000Z';

function failedOverview() {
  return {
    status: 'failed' as const,
    code: 'section_unavailable' as const,
    retryable: true as const,
  };
}

function overviewWith(
  overrides: Partial<AnalyticsOverviewResultMap> = {},
): AnalyticsOverviewResultMap {
  return {
    periodSummary: failedOverview(),
    energy: failedOverview(),
    macros: failedOverview(),
    nutrientHighlights: failedOverview(),
    hydration: failedOverview(),
    weight: failedOverview(),
    loggingConsistency: failedOverview(),
    ...overrides,
  };
}

function v2Report(
  report: unknown,
  overview: AnalyticsOverviewResultMap = overviewWith(),
) {
  const legacy = report as {
    mode: 'simple' | 'complex';
    period: 'week' | 'month';
    sections: Record<string, unknown>;
  };
  const adapted = adaptCanonicalInsightsResponseWithOverview(
    {
      ...legacy,
      sections: Object.fromEntries(
        ANALYTICS_INSIGHTS_SECTION_KEYS.flatMap((key) =>
          legacy.sections[key] === undefined
            ? []
            : [[key, legacy.sections[key]]],
        ),
      ),
      overview,
    },
    fetchedAt,
  );
  if (adapted === null) throw new Error('Invalid Insights test fixture');
  return adapted;
}

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        apiUrl: 'https://food-tracker.test/api/v1',
        appEnvironment: 'development',
      },
    },
  },
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = jest.requireActual('react') as typeof import('react');
    React.useEffect(effect, [effect]);
  },
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/analytics/analytics-cache-runtime', () => ({
  ANALYTICS_CACHE_KEYS: {
    insightsWeek: 'insights-week',
    insightsMonth: 'insights-month',
  },
  analyticsCache: () => ({
    read: jest.fn().mockResolvedValue(null),
    write: mockCacheWrite,
    purge: jest.fn(),
  }),
}));

jest.mock('@/store/app-store', () => ({
  useAppStore: () => mockDataVersion,
}));

jest.mock('@/components/auth/auth-bootstrap', () => ({
  useAuthRuntime: () => ({ userId: 'firebase-user-1' }),
}));

describe('Insights overview pin boundary', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockCacheWrite.mockReset();
    mockCacheWrite.mockResolvedValue(undefined);
    mockDataVersion = 0;
    jest.spyOn(api.analytics, 'insights').mockResolvedValue(
      v2Report({
        ...complexInsightsFixture,
        sections: {
          ...complexInsightsFixture.sections,
          calories: {
            ...complexInsightsFixture.sections.calories,
            primaryMetric: 'calories',
            summary: { average: 2000, numericDayCount: 7 },
          },
        },
      }) as never,
    );
    jest.spyOn(api.analytics, 'preferences').mockResolvedValue({
      preferredSimpleMetric: 'calories',
      pinnedSavedViewId: 'saved-view-1',
    });
    jest.spyOn(api.analytics, 'savedViews').mockResolvedValue([
      {
        id: 'saved-view-1',
        name: 'Protein · 30D',
        primaryMetric: 'protein',
        comparisonMetric: null,
        periodDays: 30,
        aggregation: 'automatic',
        visualization: 'automatic',
        showReference: true,
        coverageFilter: 'all_logged_days',
        sortOrder: 0,
        createdAt: '2026-08-09T00:00:00.000Z',
        updatedAt: '2026-08-09T00:00:00.000Z',
        unavailableMetrics: [],
      },
    ]);
    jest.spyOn(api.analytics, 'trend').mockResolvedValue({
      points: [{ kind: 'daily', date: '2026-08-08', value: 90 }],
    } as never);
    jest.spyOn(api.recommendations, 'generate').mockResolvedValue([] as never);
    jest.spyOn(api.recommendations, 'list').mockResolvedValue([]);
    jest
      .spyOn(api.analytics, 'reports')
      .mockRejectedValue(new Error('Nutrient report unavailable'));
  });

  it('keeps pinned analysis out of the exact Complex Insights overview hierarchy', async () => {
    const screen = await render(<InsightsScreen />);

    await screen.findByTestId('complex-insights-overview');
    expect(
      screen.getByTestId('complex-insights-overview').props.className,
    ).toContain('gap-7');
    expect(screen.getByText('Insights').props.className).toContain(
      'text-[22px]',
    );
    expect(
      screen.getByTestId('reporting-section-marker-energy').props.style,
    ).toEqual(expect.objectContaining({ backgroundColor: '#EA1226' }));
    expect(screen.queryByTestId('complex-insights-pinned-analysis')).toBeNull();
    expect(api.analytics.trend).not.toHaveBeenCalled();
    expect(api.analytics.preferences).not.toHaveBeenCalled();
    expect(api.analytics.savedViews).not.toHaveBeenCalled();
  });

  it('does not expose a pinned entrypoint from the exact Complex Insights overview', async () => {
    const screen = await render(<InsightsScreen />);

    await screen.findByTestId('complex-insights-overview');
    expect(
      screen.queryByRole('button', {
        name: 'Open pinned view: Protein · 30D',
      }),
    ).toBeNull();
  });

  it('routes Complex mode to the expanded, phase-aware logging preview', async () => {
    (api.analytics.insights as jest.Mock).mockResolvedValueOnce(
      v2Report(
        complexInsightsFixture,
        overviewWith({
          loggingConsistency: {
            status: 'available',
            fetchedAt,
            data: {
              completeDayCount: 1,
              partialDayCount: 1,
              unloggedDayCount: 1,
              inProgressDayCount: 1,
              eligibleLoggedDayCount: 2,
              eligibleTotalDayCount: 3,
              streak: { currentDays: 1, longestDays: 2 },
              days: [
                {
                  date: '2026-08-16',
                  loggingDayState: 'complete',
                  loggingDayPhase: 'closed',
                },
                {
                  date: '2026-08-17',
                  loggingDayState: 'partial',
                  loggingDayPhase: 'closed',
                },
                {
                  date: '2026-08-18',
                  loggingDayState: 'unlogged',
                  loggingDayPhase: 'in_progress',
                },
              ],
            },
          },
        }),
      ) as never,
    );

    const screen = await render(<InsightsScreen />);

    expect(await screen.findByLabelText('Aug 18: in_progress')).toBeTruthy();
    expect(
      screen.getByTestId('logging-consistency-heatmap-grid').props.style,
    ).toEqual(expect.objectContaining({ width: 292, gap: 8 }));
  });

  it('renders a canonical nullable aggregate as a gap rather than a zero-filled report value', async () => {
    jest.spyOn(api.analytics, 'insights').mockResolvedValueOnce(
      v2Report(
        {
          ...simpleInsightsFixture,
          sections: {
            ...simpleInsightsFixture.sections,
            protein: {
              ...simpleInsightsFixture.sections.protein,
              primaryMetric: 'protein',
              summary: { average: null, numericDayCount: 1 },
            },
          },
        },
        overviewWith({
          macros: {
            status: 'available',
            fetchedAt,
            data: {
              protein: { grams: null, percentage: null },
              carbs: { grams: null, percentage: null },
              fat: { grams: null, percentage: null },
              status: 'unknown',
            },
          },
        }),
      ) as never,
    );

    const screen = await render(<InsightsScreen />);

    expect(await screen.findByText('Protein · —')).toBeTruthy();
    expect(screen.queryByText('0 g')).toBeNull();
  });

  it('renders first-use canonical totals through the existing flat section path', async () => {
    jest.spyOn(api.analytics, 'insights').mockResolvedValueOnce(
      v2Report(
        analyticsStateFixtures.firstUse.report,
        overviewWith({
          periodSummary: {
            status: 'available',
            fetchedAt,
            data: {
              resolvedRange: {
                startDate: '2026-07-30',
                endDate: '2026-08-05',
              },
              todaySoFar: {
                date: '2026-08-05',
                mealCount: 1,
                calories: { value: 612, state: 'recorded' },
                protein: { value: 38, state: 'recorded' },
              },
              loggedDayCount: 1,
              eligibleLoggedDayCount: 1,
              eligibleTotalDayCount: 7,
              streak: { currentDays: 1, longestDays: 1 },
              currentDayPhase: 'in_progress',
              consistency: 14,
              interpretation: 'first_use',
            },
          },
          energy: {
            status: 'available',
            fetchedAt,
            data: {
              average: 612,
              numericDayCount: 1,
              reference: {
                kind: 'none',
                unit: 'kcal',
                reason: 'not_configured',
              },
              withinRangeDayCount: 0,
              comparison: { direction: 'unknown', percentage: null },
              status: 'no_reference',
            },
          },
          macros: {
            status: 'available',
            fetchedAt,
            data: {
              protein: { grams: 38, percentage: null },
              carbs: { grams: null, percentage: null },
              fat: { grams: null, percentage: null },
              status: 'partial',
            },
          },
        }),
      ) as never,
    );

    const screen = await render(<InsightsScreen />);

    expect(await screen.findByText('612')).toBeTruthy();
    expect(
      screen.getByText('38 g protein · current recorded totals'),
    ).toBeTruthy();
    expect(screen.queryByText('0 kcal')).toBeNull();
  });

  it('renders the authoritative Insights period range and logged-day count', async () => {
    (api.analytics.insights as jest.Mock).mockResolvedValueOnce(
      v2Report(
        simpleInsightsFixture,
        overviewWith({
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
        }),
      ) as never,
    );

    const screen = await render(<InsightsScreen />);

    expect(
      await screen.findByText('Aug 1 – Aug 7 · 2 logged days'),
    ).toBeTruthy();
    expect(screen.queryByText('Last 7 days')).toBeNull();
  });

  it('loads each selected period once in both directions and writes each response once', async () => {
    const screen = await render(<InsightsScreen />);
    await waitFor(() => expect(api.analytics.insights).toHaveBeenCalled());

    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Month reports' }));
    await waitFor(() =>
      expect(api.analytics.insights).toHaveBeenCalledTimes(2),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Week reports' }));
    await waitFor(() =>
      expect(api.analytics.insights).toHaveBeenCalledTimes(3),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));

    const insightCalls = (api.analytics.insights as unknown as jest.Mock).mock
      .calls as Array<['week' | 'month', unknown?]>;
    expect(insightCalls.map(([value]) => value)).toEqual([
      'week',
      'month',
      'week',
    ]);
    expect(mockCacheWrite).toHaveBeenCalledTimes(3);
  });

  it('refreshes once when the analytics data version changes', async () => {
    const screen = await render(<InsightsScreen />);
    await waitFor(() =>
      expect(api.analytics.insights).toHaveBeenCalledTimes(1),
    );

    mockDataVersion = 1;
    screen.rerender(<InsightsScreen />);
    await waitFor(() =>
      expect(api.analytics.insights).toHaveBeenCalledTimes(2),
    );
  });
});
