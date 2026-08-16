import { render } from '@/test/render';
import { View } from 'react-native';
import WaterLogScreen from '@/app/water-log';
import { api } from '@/lib/api-client';

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
    push: jest.fn(),
  }),
}));

jest.mock('@/store/app-store', () => ({
  useAppStore: (
    selector: (state: { markDataChanged: () => void }) => unknown,
  ) => selector({ markDataChanged: jest.fn() }),
}));

describe('Log Water responsive fidelity', () => {
  beforeEach(() => {
    jest.spyOn(api.analytics, 'insights').mockResolvedValue({
      contractVersion: 2,
      mode: 'simple',
      period: 'week',
      sections: {},
      overview: {
        hydration: {
          status: 'available',
          fetchedAt: '2026-08-11T12:00:00.000Z',
          data: {
            today: '2026-08-11',
            timezone: 'America/New_York',
            total: 500,
            goal: 2000,
            status: 'below_goal',
            trendSection: 'hydration',
          },
        },
      },
    } as never);
    jest.spyOn(api.profile, 'get').mockResolvedValue({
      name: 'Test',
      age: 30,
      birthDate: '1996-01-01',
      sex: 'female',
      heightInches: 67,
      timezone: 'America/New_York',
      startingWeightLb: 150,
      activityLevel: 'moderately_active',
      trainingStyle: 'mixed',
    });
    jest.spyOn(api.trackingPreferences, 'get').mockResolvedValue({
      mode: 'simple',
      waterTrackingEnabled: false,
      dailyWaterGoalMl: 2000,
    });
    jest.spyOn(api.waterLogs, 'list').mockResolvedValue([
      {
        id: 'water-1',
        amountMl: 500,
        loggedAt: '2026-08-11T12:00:00.000Z',
        createdAt: '2026-08-11T12:00:00.000Z',
        updatedAt: '2026-08-11T12:00:00.000Z',
      },
    ]);
  });

  it('keeps the 320pt add modal controls and explanatory state accessible', async () => {
    const screen = await render(
      <View testID="compact-320-water-screen" style={{ width: 320 }}>
        <WaterLogScreen />
      </View>,
    );
    expect(screen.getByTestId('compact-320-water-screen').props.style).toEqual({
      width: 320,
    });

    for (const label of ['250 mL', '350 mL', '500 mL', '750 mL']) {
      expect(
        screen.getByRole('button', { name: label }).props.className,
      ).toContain('min-h-11');
    }
    expect(
      screen.getByRole('button', { name: 'Open other water amount' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Open water time' }),
    ).toBeTruthy();
    expect(screen.getByText('Counts toward hydration')).toBeTruthy();
    expect(screen.queryByText('Today’s water')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Edit 500 mL water at/ }),
    ).toBeNull();
    expect(screen.queryByTestId('water-progress-visual')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add 250 mL' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Close water logger' }),
    ).toBeTruthy();
  });
});
