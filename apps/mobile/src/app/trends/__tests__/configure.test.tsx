import { render, userEvent } from '../../../test/render';
import type { AnalyticsMetricDefinition } from '@food-tracker/shared';
import { api } from '../../../lib/api-client';
import ConfigureTrendScreen from '../configure';

let mockRouteParams: { query?: string } = {};
const mockRouter = {
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
  push: jest.fn(),
  replace: jest.fn(),
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
  useRouter: () => mockRouter,
}));

const activeQuery = {
  primaryMetric: 'protein',
  period: { kind: 'relative' as const, days: 30 },
  aggregation: 'automatic' as const,
  visualization: 'automatic' as const,
  showReference: true,
  coverageFilter: 'all_logged_days' as const,
};

const complexCatalog: {
  mode: 'complex';
  metrics: AnalyticsMetricDefinition[];
} = {
  mode: 'complex' as const,
  metrics: [
    {
      key: 'protein' as const,
      displayName: 'Protein',
      group: 'general',
      unit: 'g',
      simpleAvailable: true,
      complexAvailable: true,
      searchableTerms: ['protein'],
      supportedVisualizations: ['automatic', 'smoothed_line'],
      supportedAggregations: ['automatic', 'daily', 'weekly'],
      supportedCoverageFilters: [
        'all_logged_days',
        'complete_and_partial',
        'complete_only',
      ],
      referenceSupport: 'target' as const,
    },
    {
      key: 'weight' as const,
      displayName: 'Weight',
      group: 'general',
      unit: 'lb',
      simpleAvailable: true,
      complexAvailable: true,
      searchableTerms: ['weight'],
      supportedVisualizations: ['automatic', 'smoothed_line'],
      supportedAggregations: ['automatic', 'daily', 'weekly'],
      supportedCoverageFilters: ['all_logged_days', 'complete_only'],
      referenceSupport: 'none' as const,
    },
  ],
};

describe('Configure Trend screen', () => {
  beforeEach(() => {
    mockRouteParams = { query: JSON.stringify(activeQuery) };
    mockRouter.back.mockReset();
    mockRouter.canGoBack.mockReturnValue(false);
    mockRouter.push.mockReset();
    mockRouter.replace.mockReset();
    jest.restoreAllMocks();
  });

  it('gates a deep-linked Configure route when the server reports Simple mode', async () => {
    jest.spyOn(api.analytics, 'trendCatalog').mockResolvedValue({
      ...complexCatalog,
      mode: 'simple',
    });

    const screen = await render(<ConfigureTrendScreen />);

    expect(
      await screen.findByText('Complex Trend controls are unavailable'),
    ).toBeTruthy();
  });

  it('keeps edits as a temporary draft until Apply changes the active route', async () => {
    jest.spyOn(api.analytics, 'trendCatalog').mockResolvedValue(complexCatalog);
    const user = userEvent.setup();
    const screen = await render(<ConfigureTrendScreen />);

    await screen.findByText('Configure Trend');
    await user.press(
      screen.getByRole('button', { name: 'Use Weight as primary metric' }),
    );
    await user.press(screen.getByRole('button', { name: '90D' }));

    expect(mockRouter.replace).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Apply changes' }));

    expect(mockRouter.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/trends/[metric]',
        params: expect.objectContaining({ metric: 'weight' }),
      }),
    );
    const route = mockRouter.replace.mock.calls[0]?.[0] as {
      params: { query: string };
    };
    expect(JSON.parse(route.params.query)).toMatchObject({
      primaryMetric: 'weight',
      period: { kind: 'relative', days: 90 },
    });
  });

  it('exposes the Configure close control as a minimum-size accessible target', async () => {
    jest.spyOn(api.analytics, 'trendCatalog').mockResolvedValue(complexCatalog);
    const screen = await render(<ConfigureTrendScreen />);

    expect(
      (await screen.findByRole('button', { name: 'Close Configure Trend' }))
        .props.className,
    ).toContain('min-h-11');
  });
});
