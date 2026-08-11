import { render } from '../../../test/render';
import { api } from '../../../lib/api-client';
import { caloriesTrendFixture } from '../../../test-fixtures/analytics-fixtures';
import TrendDetailScreen from '../[metric]';

let mockRouteParams: { metric?: string; query?: string } = {};

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
  useLocalSearchParams: () => mockRouteParams,
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/components/auth/auth-bootstrap', () => ({
  useAuthRuntime: () => ({ userId: null }),
}));

const trendResponse = caloriesTrendFixture;

describe('Trend detail screen', () => {
  beforeEach(() => {
    mockRouteParams = { metric: 'calories' };
    jest.restoreAllMocks();
    jest
      .spyOn(api.analytics, 'trend')
      .mockResolvedValue(trendResponse as never);
  });

  it('keeps Simple Trends focused and does not expose Complex-only actions', async () => {
    const screen = await render(<TrendDetailScreen />);

    expect(
      await screen.findByLabelText(
        'Calories trend for 2026-08-01 through 2026-08-07',
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Configure this Trend')).toBeNull();
    expect(screen.queryByLabelText('Save this Trend as a view')).toBeNull();
    expect(screen.queryByLabelText('View food contributors')).toBeNull();
  });

  it('keeps an applied Custom Range when restoring a Complex Trend route', async () => {
    mockRouteParams = {
      metric: 'protein',
      query: JSON.stringify({
        primaryMetric: 'protein',
        period: {
          kind: 'custom',
          startDate: '2026-06-01',
          endDate: '2026-08-01',
        },
        aggregation: 'weekly',
        visualization: 'smoothed_line',
        showReference: true,
        coverageFilter: 'complete_only',
      }),
    };
    jest.spyOn(api.analytics, 'trend').mockResolvedValue({
      ...trendResponse,
      trackingMode: 'complex',
      primaryMetric: 'protein',
      aggregation: 'weekly',
    } as never);

    const screen = await render(<TrendDetailScreen />);

    expect(
      await screen.findByLabelText(
        'Protein trend for 2026-08-01 through 2026-08-07',
      ),
    ).toBeTruthy();
    expect(api.analytics.trend).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryMetric: 'protein',
        period: {
          kind: 'custom',
          startDate: '2026-06-01',
          endDate: '2026-08-01',
        },
        aggregation: 'weekly',
        coverageFilter: 'complete_only',
      }),
    );
  });
});
