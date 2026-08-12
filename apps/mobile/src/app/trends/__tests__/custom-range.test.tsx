import { act, render, userEvent } from '../../../test/render';
import { View } from 'react-native';
import { api } from '../../../lib/api-client';
import CustomRangeScreen from '../custom-range';

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
    query: JSON.stringify({
      primaryMetric: 'calories',
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
    push: jest.fn(),
  }),
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
}));

describe('Custom Range screen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockReplace.mockReset();
    jest.spyOn(api.analytics, 'trend').mockResolvedValue({
      firstEligibleDate: '2026-07-10',
      today: '2026-08-08',
    } as never);
  });

  it('uses server bounds and returns an inclusive custom period to Configure', async () => {
    const user = userEvent.setup();
    const screen = await render(
      <View style={{ width: 320 }}>
        <CustomRangeScreen />
      </View>,
    );

    expect(await screen.findByText('Range selector')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: '14D' }));
    await user.press(screen.getByRole('button', { name: 'Apply range' }));

    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/trends/configure',
        params: expect.objectContaining({
          query: expect.stringContaining('"kind":"custom"'),
        }),
      }),
    );
  });

  it('keeps a loading failure recoverable', async () => {
    const trend = jest.spyOn(api.analytics, 'trend');
    trend.mockRejectedValueOnce(new Error('offline'));
    const screen = await render(<CustomRangeScreen />);

    expect(
      await screen.findByText(
        'The request could not be completed. Please try again.',
      ),
    ).toBeTruthy();
    await act(async () => {
      await userEvent
        .setup()
        .press(screen.getByRole('button', { name: 'Try again' }));
    });
    expect(trend).toHaveBeenCalledTimes(2);
  });
});
