import * as Haptics from 'expo-haptics';
import { View } from 'react-native';
import { act, render, userEvent, waitFor } from '../../../test/render';
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
  NotificationFeedbackType: { Success: 'success' },
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
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
    const update = jest
      .spyOn(api.analytics, 'updateSavedView')
      .mockResolvedValue({
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
    const screen = await render(
      <View testID="compact-320-saved-views" style={{ width: 320 }}>
        <SavedViewsScreen />
      </View>,
    );
    expect(screen.getByTestId('compact-320-saved-views').props.style).toEqual({
      width: 320,
    });

    await user.press(
      await screen.findByRole('button', {
        name: 'Replace unavailable metric for Historical unavailable nutrient',
      }),
    );
    await user.press(
      await screen.findByRole('button', { name: 'Use Calories' }),
    );

    expect(update).toHaveBeenCalledWith('1', {
      primaryMetric: 'calories',
      comparisonMetric: null,
    });
    expect(screen.queryByText('Needs replacement: retiredNutrient')).toBeNull();
  });

  it('opens the Save View flow with a valid default Trend query', async () => {
    const screen = await render(<SavedViewsScreen />);

    await userEvent
      .setup()
      .press(
        await screen.findByRole('button', { name: 'Create a saved view' }),
      );

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/trends/save-view',
      params: {
        query: JSON.stringify({
          primaryMetric: 'calories',
          period: { kind: 'relative', days: 30 },
          aggregation: 'automatic',
          visualization: 'automatic',
          showReference: true,
          coverageFilter: 'all_logged_days',
        }),
      },
    });
  });

  it('confirms destructive deletion with feedback after the request succeeds', async () => {
    jest.spyOn(api.analytics, 'deleteSavedView').mockResolvedValue({
      id: '1',
      deleted: true,
    });
    const screen = await render(<SavedViewsScreen />);

    await userEvent.setup().press(
      await screen.findByRole('button', {
        name: 'More actions for Historical unavailable nutrient',
      }),
    );
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Delete saved view' }));
    const deleteButtons = screen.getAllByRole('button', {
      name: 'Delete saved view',
    });
    await userEvent.setup().press(deleteButtons[deleteButtons.length - 1]!);

    await waitFor(() =>
      expect(api.analytics.deleteSavedView).toHaveBeenCalledWith('1'),
    );
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('keeps the inline rename confirmation at the minimum analytics target size', async () => {
    const user = userEvent.setup();
    const screen = await render(<SavedViewsScreen />);

    await user.press(
      await screen.findByRole('button', {
        name: 'More actions for Historical unavailable nutrient',
      }),
    );
    await user.press(screen.getByRole('button', { name: 'Rename' }));

    expect(
      screen.getByRole('button', {
        name: 'Save name for Historical unavailable nutrient',
      }).props.className,
    ).toContain('min-h-11');
  });

  it('reorders a saved view from its drag handle and persists the new order', async () => {
    jest.spyOn(api.analytics, 'savedViews').mockResolvedValueOnce([
      {
        id: '1',
        name: 'First view',
        primaryMetric: 'calories',
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
      {
        id: '2',
        name: 'Second view',
        primaryMetric: 'protein',
        comparisonMetric: null,
        periodDays: 30,
        aggregation: 'automatic',
        visualization: 'automatic',
        showReference: true,
        coverageFilter: 'all_logged_days',
        sortOrder: 1,
        createdAt: '2026-08-09T00:00:00.000Z',
        updatedAt: '2026-08-09T00:00:00.000Z',
        unavailableMetrics: [],
      },
    ]);
    const reorder = jest
      .spyOn(api.analytics, 'reorderSavedViews')
      .mockResolvedValue([]);
    const screen = await render(<SavedViewsScreen />);
    const handle = await screen.findByLabelText('Reorder First view');

    await act(async () => {
      handle.props.onAccessibilityAction({
        nativeEvent: { actionName: 'increment' },
      });
    });

    await waitFor(() =>
      expect(reorder).toHaveBeenCalledWith({ ids: ['2', '1'] }),
    );
  });

  it('shows a recoverable error when pinning a saved view fails', async () => {
    jest.spyOn(api.analytics, 'savedViews').mockResolvedValueOnce([
      {
        id: '1',
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
    jest
      .spyOn(api.analytics, 'updatePreferences')
      .mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    const screen = await render(<SavedViewsScreen />);

    await user.press(
      await screen.findByRole('button', {
        name: 'More actions for Protein · 30D',
      }),
    );
    await user.press(screen.getByRole('button', { name: 'Pin to Insights' }));

    expect(
      await screen.findByText(
        'The request could not be completed. Please try again.',
      ),
    ).toBeTruthy();
  });

  it('confirms a successful pin with light haptic feedback', async () => {
    jest.spyOn(api.analytics, 'savedViews').mockResolvedValueOnce([
      {
        id: '1',
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
    jest.spyOn(api.analytics, 'updatePreferences').mockResolvedValueOnce({
      preferredSimpleMetric: 'calories',
      pinnedSavedViewId: '1',
    });
    const user = userEvent.setup();
    const screen = await render(<SavedViewsScreen />);

    await user.press(
      await screen.findByRole('button', {
        name: 'More actions for Protein · 30D',
      }),
    );
    await user.press(screen.getByRole('button', { name: 'Pin to Insights' }));

    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(
      screen.getByRole('button', { name: 'More actions for Protein · 30D' }),
    ).toBeTruthy();
  });

  it('wraps long saved-view names while preserving a compact action target', async () => {
    const longName = 'Protein + Weight + nutrition consistency · last 90 days';
    jest.spyOn(api.analytics, 'savedViews').mockResolvedValueOnce([
      {
        id: 'long-name',
        name: longName,
        primaryMetric: 'protein',
        comparisonMetric: 'weight',
        periodDays: 90,
        aggregation: 'weekly',
        visualization: 'dual_axis',
        showReference: true,
        coverageFilter: 'all_logged_days',
        sortOrder: 0,
        createdAt: '2026-08-09T00:00:00.000Z',
        updatedAt: '2026-08-09T00:00:00.000Z',
        unavailableMetrics: [],
      },
    ]);
    const screen = await render(
      <View testID="compact-320-saved-view-long-name" style={{ width: 320 }}>
        <SavedViewsScreen />
      </View>,
    );
    expect(
      screen.getByTestId('compact-320-saved-view-long-name').props.style,
    ).toEqual({ width: 320 });

    expect(screen.getByText(longName).props.numberOfLines).toBe(3);
    expect(
      screen.getByRole('button', { name: `More actions for ${longName}` }).props
        .className,
    ).toContain('min-h-11');
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: `Open ${longName}` }));
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/trends/[metric]' }),
    );
  });
});
