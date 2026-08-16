import { render } from '../../../test/render';
import { Dimensions } from 'react-native';
import { api } from '../../../lib/api-client';
import { caloriesTrendFixture } from '../../../test-fixtures/analytics-fixtures';
import { analyticsStateFixtures } from '../../../test-fixtures/analytics-state-fixtures';
import TrendDetailScreen from '../[metric]';

let mockRouteParams: { metric?: string; query?: string } = {};
let mockWindowDimensions: ReturnType<typeof Dimensions.get> = {
  ...analyticsStateFixtures.layouts.standard390,
  height: 844,
  scale: 3,
};

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
    mockWindowDimensions = {
      ...analyticsStateFixtures.layouts.standard390,
      height: 844,
      scale: 3,
    };
    jest.restoreAllMocks();
    jest
      .spyOn(Dimensions, 'get')
      .mockImplementation(() => mockWindowDimensions);
    jest
      .spyOn(api.analytics, 'trend')
      .mockResolvedValue(trendResponse as never);
  });

  it('keeps Simple Trends focused and does not expose Complex-only actions', async () => {
    const screen = await render(<TrendDetailScreen />);

    expect(
      await screen.findByLabelText('Calories trend for Jul 6 – Aug 4'),
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
      await screen.findByLabelText('Protein trend for Jul 6 – Aug 4'),
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

  it('renders the exact canonical 30-day fixture at compact width', async () => {
    mockWindowDimensions = {
      ...analyticsStateFixtures.layouts.compact320,
      height: 693,
      scale: 2,
    };

    const screen = await render(<TrendDetailScreen />);

    expect(
      await screen.findByLabelText('Calories trend for Jul 6 – Aug 4'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Inspect chart values').props.style).toEqual(
      expect.objectContaining({ width: 280 }),
    );
    expect(screen.getByText('Average 1,846 kcal')).toBeTruthy();
  });

  it('keeps the rendered accessibility path reachable with a Large Type input', async () => {
    mockWindowDimensions = {
      ...analyticsStateFixtures.layouts.largeType390,
      height: 844,
      scale: 3,
    };

    const screen = await render(<TrendDetailScreen />);

    const trend = await screen.findByLabelText(
      'Calories trend for Jul 6 – Aug 4',
    );
    const average = screen.getByText('Average 1,846 kcal');
    let ancestor = average.parent;
    while (
      ancestor !== null &&
      ancestor.props.contentContainerStyle === undefined
    ) {
      ancestor = ancestor.parent;
    }

    expect(trend).toBeTruthy();
    expect(average.props.allowFontScaling).not.toBe(false);
    expect(ancestor?.props.contentContainerStyle).toEqual({
      backgroundColor: '#FFFFFF',
    });
    expect(screen.getByLabelText('Inspect chart values').props.style).toEqual(
      expect.objectContaining({ width: 350 }),
    );
  });
});
