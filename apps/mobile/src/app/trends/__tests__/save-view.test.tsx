import { render, userEvent } from '../../../test/render';
import { api } from '../../../lib/api-client';
import SaveViewScreen from '../save-view';

const mockReplace = jest.fn();

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
  useLocalSearchParams: () => ({
    savedViewId: 'saved-view-1',
    query: JSON.stringify({
      primaryMetric: 'protein',
      period: { kind: 'relative', days: 30 },
      aggregation: 'automatic',
      visualization: 'automatic',
      showReference: true,
      coverageFilter: 'all_logged_days',
    }),
  }),
  useRouter: () => ({
    canGoBack: () => false,
    back: jest.fn(),
    replace: mockReplace,
  }),
}));

describe('Save view screen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockReplace.mockReset();
  });

  it('updates an opened saved view without creating a second view', async () => {
    const update = jest
      .spyOn(api.analytics, 'updateSavedView')
      .mockResolvedValue({
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
        updatedAt: '2026-08-09T00:01:00.000Z',
        unavailableMetrics: [],
      });
    const create = jest.spyOn(api.analytics, 'createSavedView');
    const screen = await render(<SaveViewScreen />);

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Update existing view' }));

    expect(update).toHaveBeenCalledWith('saved-view-1', {
      name: 'Protein · 30D',
      primaryMetric: 'protein',
      comparisonMetric: null,
      periodDays: 30,
      aggregation: 'automatic',
      visualization: 'automatic',
      showReference: true,
      coverageFilter: 'all_logged_days',
    });
    expect(create).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/trends/saved-views');
  });
});
