import { render, userEvent } from '../../../test/render';
import { api } from '../../../lib/api-client';
import SavedViewsScreen from '../saved-views';

const mockRouter = { push: jest.fn() };
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

jest.mock('expo-router', () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      if (!mockFocusInvoked) {
        mockFocusInvoked = true;
        effect();
      }
    },
    useRouter: () => mockRouter,
  };
});

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
}));

describe('Saved Views screen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockRouter.push.mockReset();
    mockFocusInvoked = false;
    jest.spyOn(api.analytics, 'preferences').mockResolvedValue({
      preferredSimpleMetric: 'calories',
      pinnedSavedViewId: null,
    });
    jest.spyOn(api.analytics, 'savedViews').mockResolvedValue([
      {
        id: '1',
        name: 'Historical unavailable nutrient',
        primaryMetric: 'retiredNutrient',
        comparisonMetric: null,
        periodDays: 30,
        aggregation: 'automatic',
        visualization: 'automatic',
        showReference: true,
        coverageFilter: 'all_logged_days',
        sortOrder: 0,
        createdAt: '2026-08-09T00:00:00.000Z',
        updatedAt: '2026-08-09T00:00:00.000Z',
        unavailableMetrics: ['retiredNutrient'],
      },
    ]);
    jest.spyOn(api.analytics, 'trendCatalog').mockResolvedValue({
      mode: 'complex',
      metrics: [
        {
          key: 'calories',
          displayName: 'Calories',
          group: 'general',
          unit: 'kcal',
          simpleAvailable: true,
          complexAvailable: true,
          searchableTerms: ['calories'],
          supportedVisualizations: ['automatic', 'bars_with_trend'],
          supportedAggregations: ['automatic', 'daily'],
          supportedCoverageFilters: ['all_logged_days'],
          referenceSupport: 'range',
        },
      ],
    });
  });

  it('replaces an unavailable saved metric with a server-authorized metric', async () => {
    const update = jest.spyOn(api.analytics, 'updateSavedView').mockResolvedValue({
      id: '1',
      name: 'Historical unavailable nutrient',
      primaryMetric: 'calories',
      comparisonMetric: null,
      periodDays: 30,
      aggregation: 'automatic',
      visualization: 'automatic',
      showReference: true,
      coverageFilter: 'all_logged_days',
      sortOrder: 0,
      createdAt: '2026-08-09T00:00:00.000Z',
      updatedAt: '2026-08-09T00:01:00.000Z',
      unavailableMetrics: [],
    });
    const user = userEvent.setup();
    const screen = await render(<SavedViewsScreen />);

    await user.press(
      await screen.findByRole('button', {
        name: 'Replace unavailable metric for Historical unavailable nutrient',
      }),
    );
    await user.press(await screen.findByRole('button', { name: 'Use Calories' }));

    expect(update).toHaveBeenCalledWith('1', {
      primaryMetric: 'calories',
      comparisonMetric: null,
    });
    expect(screen.queryByText('Needs replacement: retiredNutrient')).toBeNull();
  });
});
