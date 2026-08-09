import { render } from '../../test/render';
import WaterLogScreen from '../water-log';

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
  useLocalSearchParams: () => ({}),
  useRouter: () => ({
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
    replace: jest.fn(),
  }),
}));

jest.mock('@/store/app-store', () => ({
  useAppStore: (
    selector: (state: { markDataChanged: () => void }) => unknown,
  ) => selector({ markDataChanged: jest.fn() }),
}));

describe('Water Log screen', () => {
  it('exposes a minimum-size accessible close action', async () => {
    const screen = await render(<WaterLogScreen />);

    expect(
      (await screen.findByRole('button', { name: 'Close water logger' })).props
        .className,
    ).toContain('min-h-11');
  });
});
