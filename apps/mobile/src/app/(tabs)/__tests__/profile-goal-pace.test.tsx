import { useEffect as mockUseEffect } from 'react';
import { api } from '@/lib/api-client';
import { render, screen, userEvent, waitFor } from '@/test/render';
import ProfileScreen from '../profile';

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
  useFocusEffect: (effect: () => void | (() => void)) => {
    mockUseEffect(effect, []);
  },
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/components/auth/auth-bootstrap', () => ({
  useAuthRuntime: () => ({
    deleteAccount: jest.fn(),
    signOut: jest.fn(),
  }),
}));

jest.mock('@/store/app-store', () => ({
  useAppStore: (selector: (state: { markDataChanged: jest.Mock }) => unknown) =>
    selector({ markDataChanged: jest.fn() }),
}));

jest.mock('@/lib/app-icon', () => ({
  syncLauncherIconToMode: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/lib/remote-push-capability', () => ({
  isRemotePushEnabled: () => false,
}));

jest.mock('@/services/notifications', () => ({
  registerPushInstallation: jest.fn(),
}));

jest.mock('@/components/auth/account-sign-out-button', () => ({
  AccountSignOutButton: () => null,
}));

jest.mock('@/components/auth/account-deletion', () => ({
  DeleteAccountPanel: () => null,
}));

describe('Profile goal pace controls', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(api.profile, 'get').mockResolvedValue({
      name: 'QA',
      age: 34,
      birthDate: '1992-06-15',
      sex: 'male',
      heightInches: 70,
      timezone: 'America/Toronto',
      startingWeightLb: 182,
      activityLevel: 'sedentary',
      trainingStyle: 'none',
    });
    jest.spyOn(api.goals, 'get').mockResolvedValue({
      goalType: 'maintain',
      goalPace: null,
      targetRateLbPerWeek: null,
      targetWeightLb: 182,
      targetCalories: 2600,
      targetProteinGrams: 153.7,
      targetCarbsGrams: null,
      targetFatGrams: null,
      targetFiberGrams: null,
      limitSugarGrams: null,
      limitSodiumMg: null,
    });
    jest.spyOn(api.trackingPreferences, 'get').mockResolvedValue({
      mode: 'complex',
      waterTrackingEnabled: true,
      dailyWaterGoalMl: 2000,
    });
    jest.spyOn(api.notifications.preferences, 'get').mockResolvedValue({
      recommendationInsightsEnabled: false,
      loggingRemindersEnabled: false,
    });
  });

  it('does not expose legacy categorical pace choices for a loss goal', async () => {
    render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText('Edit goals')).toBeTruthy());

    await userEvent.setup().press(screen.getByRole('button', { name: 'Lose' }));

    expect(screen.queryByRole('button', { name: 'Slow' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aggressive' })).toBeNull();
    expect(
      screen.getByText('Weekly rate (lb/week)'),
    ).toBeTruthy();
  });
});
