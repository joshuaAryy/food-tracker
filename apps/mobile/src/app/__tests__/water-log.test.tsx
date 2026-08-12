import { render, userEvent, waitFor } from '../../test/render';
import { api } from '@/lib/api-client';
import WaterLogScreen from '../water-log';

const mockRouteParams = jest.fn(() => ({}));

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
  beforeEach(() => {
    jest.restoreAllMocks();
    mockRouteParams.mockReturnValue({});
  });

  it('exposes a minimum-size accessible close action', async () => {
    const screen = await render(<WaterLogScreen />);

    expect(
      (await screen.findByRole('button', { name: 'Close water logger' })).props
        .className,
    ).toContain('min-h-11');
  });

  it('does not enable logging when authoritative hydration context is unavailable', async () => {
    jest
      .spyOn(api.analytics, 'insights')
      .mockRejectedValue(new Error('analytics unavailable'));

    const screen = await render(<WaterLogScreen />);
    const addButton = await screen.findByRole('button', {
      name: 'Add 250 mL',
    });

    expect(
      await screen.findByText(
        'Today’s water history is temporarily unavailable.',
      ),
    ).toBeTruthy();
    expect(addButton.props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText('Hydration today')).toBeTruthy();
    expect(screen.getByText('Goal —')).toBeTruthy();
  });

  it('loads an edited entry only after the canonical timezone is known', async () => {
    mockRouteParams.mockReturnValue({ id: 'water-1' });
    jest.spyOn(api.analytics, 'insights').mockResolvedValue({
      overview: {
        hydration: {
          status: 'available',
          fetchedAt: '2026-08-11T12:00:00.000Z',
          data: {
            today: '2026-08-11',
            timezone: 'Asia/Tokyo',
            total: 500,
            goal: 2000,
            status: 'below_goal',
            trendSection: 'hydration',
          },
        },
      },
    } as never);
    jest.spyOn(api.waterLogs, 'list').mockResolvedValue([]);
    const getById = jest.spyOn(api.waterLogs, 'getById').mockResolvedValue({
      id: 'water-1',
      amountMl: 500,
      loggedAt: '2026-08-10T23:30:00.000Z',
      createdAt: '2026-08-10T23:30:00.000Z',
      updatedAt: '2026-08-10T23:30:00.000Z',
    });

    const screen = await render(<WaterLogScreen />);
    await screen.findByText('Edit water');
    await waitFor(() => expect(getById).toHaveBeenCalled());

    expect(screen.getByDisplayValue('2026-08-11')).toBeTruthy();
    expect(screen.getByDisplayValue('08:30')).toBeTruthy();
  });

  it('retries canonical hydration context before retrying an edited entry', async () => {
    mockRouteParams.mockReturnValue({ id: 'water-1' });
    const insights = jest
      .spyOn(api.analytics, 'insights')
      .mockRejectedValueOnce(new Error('analytics unavailable'))
      .mockResolvedValueOnce({
        overview: {
          hydration: {
            status: 'available',
            fetchedAt: '2026-08-11T12:00:00.000Z',
            data: {
              today: '2026-08-11',
              timezone: 'Asia/Tokyo',
              total: 500,
              goal: 2000,
              status: 'below_goal',
              trendSection: 'hydration',
            },
          },
        },
      } as never);
    jest.spyOn(api.waterLogs, 'list').mockResolvedValue([]);
    jest.spyOn(api.waterLogs, 'getById').mockResolvedValue({
      id: 'water-1',
      amountMl: 500,
      loggedAt: '2026-08-10T23:30:00.000Z',
      createdAt: '2026-08-10T23:30:00.000Z',
      updatedAt: '2026-08-10T23:30:00.000Z',
    });

    const screen = await render(<WaterLogScreen />);
    const retry = await screen.findByRole('button', { name: 'Try again' });
    await userEvent.setup().press(retry);

    await waitFor(() => expect(insights).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Edit water')).toBeTruthy();
    expect(screen.getByDisplayValue('2026-08-11')).toBeTruthy();
  });
});
