import { render } from '../../../test/render';
import { api } from '../../../lib/api-client';
import InsightsScreen from '../insights';

let mockFocusInvoked = false;

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
    if (!mockFocusInvoked) {
      mockFocusInvoked = true;
      effect();
    }
  },
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/store/app-store', () => ({
  useAppStore: () => 0,
}));

jest.mock('@/components/auth/auth-bootstrap', () => ({
  useAuthRuntime: () => ({ userId: 'firebase-user-1' }),
}));

describe('Insights pinned view', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockFocusInvoked = false;
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
});
