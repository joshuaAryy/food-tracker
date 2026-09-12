import { act, render, waitFor } from '../../../test/render';
import { api } from '@/lib/api-client';
import FoodLibraryDetailScreen from '../library-detail';

let focusEffect: (() => void) | null = null;
let mockFocusInvocationCount = 0;

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
  useLocalSearchParams: () => ({ id: 'food-1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useFocusEffect: (effect: () => void) => {
    focusEffect = effect;
    if (mockFocusInvocationCount === 0) {
      mockFocusInvocationCount += 1;
      effect();
    }
  },
}));

jest.mock('@/store/app-store', () => ({
  useAppStore: (
    selector: (state: { markDataChanged: () => void }) => unknown,
  ) => selector({ markDataChanged: jest.fn() }),
}));

const food = {
  id: 'food-1',
  name: 'QA Archive Probe',
  description: null,
  sourceType: 'user_custom',
  sourceProvider: 'manual',
  sourceId: null,
  brandName: null,
  barcode: null,
  calories: 10,
  protein: 1,
  carbs: 1,
  fat: 0.5,
  fiber: 0,
  sugar: null,
  sodium: null,
  servingQuantity: 100,
  servingUnit: 'g',
  servingOptions: null,
  nutrients: {},
  isSaved: true,
  defaultServing: null,
} as never;

describe('Food Library detail screen', () => {
  beforeEach(() => {
    focusEffect = null;
    mockFocusInvocationCount = 0;
    jest.restoreAllMocks();
    jest.spyOn(api.foodItems, 'libraryDetail').mockResolvedValue(food);
    jest
      .spyOn(api.trackingPreferences, 'get')
      .mockResolvedValue({ mode: 'complex' } as never);
  });

  it('reloads the canonical detail after returning from an edit route', async () => {
    await render(<FoodLibraryDetailScreen />);
    await waitFor(() =>
      expect(api.foodItems.libraryDetail).toHaveBeenCalledTimes(1),
    );

    expect(focusEffect).not.toBeNull();
    await act(async () => {
      focusEffect?.();
    });

    await waitFor(() =>
      expect(api.foodItems.libraryDetail).toHaveBeenCalledTimes(2),
    );
  });
});
