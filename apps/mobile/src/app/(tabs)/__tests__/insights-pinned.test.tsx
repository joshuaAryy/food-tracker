import { render, userEvent, waitFor } from '../../../test/render';
import { api } from '../../../lib/api-client';
import InsightsScreen from '../insights';

const mockCacheWrite = jest.fn();
let mockDataVersion = 0;

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

describe('Insights pinned view', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockCacheWrite.mockReset();
    mockCacheWrite.mockResolvedValue(undefined);
    mockDataVersion = 0;
    jest.spyOn(api.analytics, 'insights').mockResolvedValue({
      mode: 'complex',
      sections: {
        calories: {
          primaryMetric: 'calories',
          summary: { average: 2000, numericDayCount: 7 },
        },
      },
    } as never);
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
  });

  it('loads a pinned saved configuration as an independent canonical trend preview', async () => {
    const screen = await render(<InsightsScreen />);

    expect(
      await screen.findByLabelText('Protein · 30D primary view preview'),
    ).toBeTruthy();
    expect(api.analytics.trend).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryMetric: 'protein',
        period: { kind: 'relative', days: 30 },
      }),
    );
  });

  it('keeps the pinned Insights preview as a minimum-size accessible Trend entrypoint', async () => {
    const screen = await render(<InsightsScreen />);

    expect(
      (
        await screen.findByRole('button', {
          name: 'Open pinned view: Protein · 30D',
        })
      ).props.className,
    ).toContain('min-h-11');
  });

  it('renders a canonical nullable aggregate as a gap rather than a zero-filled report value', async () => {
    jest.spyOn(api.analytics, 'insights').mockResolvedValueOnce({
      mode: 'simple',
      sections: {
        protein: {
          primaryMetric: 'protein',
          summary: { average: null, numericDayCount: 1 },
        },
      },
    } as never);

    const screen = await render(<InsightsScreen />);

    expect(await screen.findByText('Protein')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('1 recorded g days')).toBeTruthy();
    expect(screen.queryByText('0.0')).toBeNull();
  });

  it('loads each selected period once in both directions and writes each response once', async () => {
    const screen = await render(<InsightsScreen />);
    await waitFor(() => expect(api.analytics.insights).toHaveBeenCalled());

    await userEvent
      .setup()
      .press(await screen.findByRole('tab', { name: 'Month reports' }));
    await waitFor(() =>
      expect(api.analytics.insights).toHaveBeenCalledTimes(2),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    await userEvent
      .setup()
      .press(await screen.findByRole('tab', { name: 'Week reports' }));
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
