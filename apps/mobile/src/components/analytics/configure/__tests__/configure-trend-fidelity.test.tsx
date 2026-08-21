import { render, userEvent } from '@/test/render';
import type {
  AnalyticsMetricDefinition,
  AnalyticsSavedView,
} from '@food-tracker/shared';
import { api } from '@/lib/api-client';
import ConfigureTrendScreen from '@/app/trends/configure';

let mockRouteParams: { query?: string; savedViewId?: string } = {};
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

const query = {
  primaryMetric: 'protein' as const,
  period: { kind: 'relative' as const, days: 30 },
  aggregation: 'automatic' as const,
  visualization: 'automatic' as const,
  showReference: true,
  coverageFilter: 'complete_and_partial' as const,
};

const definitions: AnalyticsMetricDefinition[] = [
  {
    key: 'protein',
    displayName: 'Protein',
    group: 'general',
    unit: 'g',
    simpleAvailable: true,
    complexAvailable: true,
    searchableTerms: ['protein'],
    supportedVisualizations: ['automatic', 'smoothed_line'],
    supportedAggregations: ['automatic', 'daily', 'weekly', 'monthly'],
    supportedCoverageFilters: [
      'all_logged_days',
      'complete_and_partial',
      'complete_only',
    ],
    referenceSupport: 'target',
  },
  {
    key: 'hydration',
    displayName: 'Hydration',
    group: 'hydration',
    unit: 'mL',
    simpleAvailable: true,
    complexAvailable: true,
    searchableTerms: ['hydration', 'water'],
    supportedVisualizations: ['automatic', 'smoothed_line'],
    supportedAggregations: ['automatic', 'daily', 'weekly', 'monthly'],
    supportedCoverageFilters: [],
    referenceSupport: 'target',
  },
  {
    key: 'weight',
    displayName: 'Weight',
    group: 'body',
    unit: 'lb',
    simpleAvailable: true,
    complexAvailable: true,
    searchableTerms: ['weight'],
    supportedVisualizations: ['automatic', 'smoothed_line'],
    supportedAggregations: ['automatic', 'daily', 'weekly', 'monthly'],
    supportedCoverageFilters: [],
    referenceSupport: 'target',
  },
];

const savedView: AnalyticsSavedView = {
  id: 'saved-view-1',
  name: 'Protein + Weight · 90D',
  primaryMetric: 'protein',
  comparisonMetric: 'weight',
  periodDays: 90,
  aggregation: 'automatic',
  visualization: 'dual_axis',
  showReference: true,
  coverageFilter: 'complete_and_partial',
  sortOrder: 0,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  unavailableMetrics: [],
};

describe('Configure Trend fidelity', () => {
  beforeEach(() => {
    mockRouteParams = {
      query: JSON.stringify(query),
      savedViewId: savedView.id,
    };
    mockRouter.back.mockReset();
    mockRouter.push.mockReset();
    mockRouter.replace.mockReset();
    jest.spyOn(api.analytics, 'trendCatalog').mockResolvedValue({
      mode: 'complex',
      metrics: definitions,
    });
    jest.spyOn(api.analytics, 'savedViews').mockResolvedValue([savedView]);
  });

  it('keeps saved-view context and exposes Save as new view without replacing the draft', async () => {
    const screen = await render(<ConfigureTrendScreen />);
    const user = userEvent.setup();

    expect(await screen.findByText('Protein + Weight · 90D')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Save as new view' }));

    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/trends/save-view',
        params: expect.objectContaining({ savedViewId: savedView.id }),
      }),
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('keeps saved-view context when applying and makes visualization selection actionable', async () => {
    const screen = await render(<ConfigureTrendScreen />);
    const user = userEvent.setup();

    await user.press(
      screen.getByRole('button', { name: 'Open Visualization' }),
    );
    expect(
      screen.getByRole('button', { name: 'Use Smoothed Line' }),
    ).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Use Smoothed Line' }));

    await user.press(screen.getByRole('button', { name: 'Apply changes' }));
    expect(mockRouter.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          savedViewId: savedView.id,
          query: expect.stringContaining('smoothed_line'),
        }),
      }),
    );
  });

  it('hides food-log coverage for Weight and disables unsupported short-range aggregation overrides', async () => {
    mockRouteParams.query = JSON.stringify({
      ...query,
      period: { kind: 'relative' as const, days: 7 },
    });
    const screen = await render(<ConfigureTrendScreen />);
    const user = userEvent.setup();

    expect(
      screen.getByRole('button', { name: 'Open Data coverage' }),
    ).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Open Aggregation' }));
    expect(screen.queryByRole('button', { name: 'Weekly' })).toBeNull();
    await user.press(
      screen.getByRole('button', { name: 'Done with Aggregation' }),
    );
    await user.press(
      screen.getByRole('button', { name: 'Open Primary metric' }),
    );
    await user.press(
      screen.getByRole('button', { name: 'Use Weight as primary metric' }),
    );

    expect(
      screen.queryByRole('button', { name: 'Open Data coverage' }),
    ).toBeNull();

    await user.press(
      screen.getByRole('button', { name: 'Open Primary metric' }),
    );
    await user.press(
      screen.getByRole('button', { name: 'Use Hydration as primary metric' }),
    );
    expect(
      screen.queryByRole('button', { name: 'Open Data coverage' }),
    ).toBeNull();
  });
});
