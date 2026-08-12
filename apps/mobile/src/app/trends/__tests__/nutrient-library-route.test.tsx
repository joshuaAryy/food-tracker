import type { ReportsResponse } from '@food-tracker/shared';
import { render, userEvent } from '../../../test/render';
import { api } from '../../../lib/api-client';
import NutrientLibraryScreen from '../nutrients/index';

let mockRouteParams: { category?: string; query?: string } = {};
const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
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

const report = {
  goalDirection: null,
  current: { nutrientDetails: {} },
} as unknown as ReportsResponse;

describe('Nutrient library route boundary', () => {
  beforeEach(() => {
    mockRouteParams = {};
    mockRouter.back.mockReset();
    mockRouter.push.mockReset();
    jest.restoreAllMocks();
  });

  it('blocks a Simple deep link without requesting the Complex report', async () => {
    const catalog = jest
      .spyOn(api.analytics, 'trendCatalog')
      .mockResolvedValue({
        mode: 'simple',
        metrics: [],
      });
    const reports = jest.spyOn(api.analytics, 'reports');

    const screen = await render(<NutrientLibraryScreen />);

    expect(
      await screen.findByText('Nutrient library is unavailable'),
    ).toBeTruthy();
    expect(catalog).toHaveBeenCalledTimes(1);
    expect(reports).not.toHaveBeenCalled();
  });

  it('preserves category navigation as a category route state', async () => {
    jest.spyOn(api.analytics, 'trendCatalog').mockResolvedValue({
      mode: 'complex',
      metrics: [],
    });
    jest.spyOn(api.analytics, 'reports').mockResolvedValue(report);

    const screen = await render(<NutrientLibraryScreen />);
    await screen.findByText('Complete nutrient report');
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Open Vitamins category' }));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/trends/nutrients',
      params: { category: 'vitamins' },
    });
  });
});
