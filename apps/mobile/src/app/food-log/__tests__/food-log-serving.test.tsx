import { act, render, waitFor } from '../../../test/render';
import { api } from '@/lib/api-client';
import FoodLogScreen from '../../food-log';

const mockRouteParams = jest.fn(() => ({ scannedFoodItemId: 'food-1' }));

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
  useLocalSearchParams: () => mockRouteParams(),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/store/app-store', () => ({
  useAppStore: (
    selector: (state: { markDataChanged: () => void }) => unknown,
  ) => selector({ markDataChanged: jest.fn() }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

const scannedFood = {
  id: 'food-1',
  name: 'Scanned packaged food',
  description: null,
  sourceType: 'branded',
  sourceProvider: 'open_food_facts',
  sourceId: 'barcode-1',
  brandName: 'QA Brand',
  barcode: '0123456789012',
  calories: 250,
  protein: 8,
  carbs: 30,
  fat: 10,
  fiber: null,
  sugar: null,
  sodium: null,
  servingQuantity: 100,
  servingUnit: 'g',
  servingOptions: null,
  nutrients: {},
  isSaved: false,
  defaultServing: null,
} as never;

describe('Food Log barcode serving initialization', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockRouteParams.mockReturnValue({ scannedFoodItemId: 'food-1' });
  });

  it('preserves the scanned food serving basis when general initialization resolves later', async () => {
    const profile = deferred<Awaited<ReturnType<typeof api.profile.get>>>();
    const preferences = deferred<
      Awaited<ReturnType<typeof api.trackingPreferences.get>>
    >();
    const recent = deferred<never[]>();
    const saved = deferred<never[]>();

    jest.spyOn(api.profile, 'get').mockReturnValue(profile.promise);
    jest
      .spyOn(api.trackingPreferences, 'get')
      .mockReturnValue(preferences.promise);
    jest.spyOn(api.foodLogs, 'list').mockReturnValue(recent.promise);
    jest.spyOn(api.foodItems, 'list').mockReturnValue(saved.promise);
    const getById = jest
      .spyOn(api.foodItems, 'getById')
      .mockResolvedValue(scannedFood);

    const screen = await render(<FoodLogScreen />);

    await waitFor(() => expect(getById).toHaveBeenCalledWith('food-1'));
    await waitFor(() =>
      expect(screen.getByText('Scanned packaged food')).toBeTruthy(),
    );

    await act(async () => {
      profile.resolve({
        name: 'QA A',
        age: 30,
        birthDate: '1996-01-01',
        sex: 'female',
        heightInches: 65,
        timezone: 'America/Toronto',
        startingWeightLb: 150,
        activityLevel: 'moderately_active',
        trainingStyle: 'mixed',
      });
      preferences.resolve({
        mode: 'complex',
        waterTrackingEnabled: true,
        dailyWaterGoalMl: 2000,
      });
      recent.resolve([]);
      saved.resolve([]);
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByDisplayValue('100')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Use g' })).toBeTruthy();
  });
});
