import { useEffect as mockUseEffect } from 'react';
import { act, render, userEvent, waitFor } from '@/test/render';
import { api } from '@/lib/api-client';
import {
  progressRegressionNextModePreferences,
  progressRegressionPreferences,
  progressRegressionReporting,
  progressRegressionSummary,
} from '@/lib/progress/progress-transition-fixtures';
import ProgressScreen from '../progress';

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

jest.mock('@/store/app-store', () => ({
  useAppStore: (
    selector: (state: {
      dataVersion: number;
      markDataChanged: jest.Mock;
    }) => unknown,
  ) => selector({ dataVersion: 0, markDataChanged: jest.fn() }),
}));

jest.mock('@/lib/app-icon', () => ({
  syncLauncherIconToMode: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/components/progress-reporting-summary', () => ({
  ProgressCalorieHero: () => null,
  ProgressReportingSummary: () => null,
}));

jest.mock('@/components/streak-entry-action', () => ({
  StreakEntryAction: () => null,
}));

function mockResources() {
  jest
    .spyOn(api.dashboard, 'summary')
    .mockResolvedValue(progressRegressionSummary);
  jest.spyOn(api.profile, 'get').mockResolvedValue({} as never);
  jest.spyOn(api.trackingPreferences, 'get').mockResolvedValue({
    ...progressRegressionPreferences,
    dailyWaterGoalMl: 2000,
  });
  jest
    .spyOn(api.analytics, 'progress')
    .mockResolvedValue(progressRegressionReporting as never);
  jest.spyOn(api.analytics, 'reports').mockResolvedValue({} as never);
  jest.spyOn(api.analytics, 'dailyNutrients').mockResolvedValue({} as never);
}

describe('Progress physical regressions', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockResources();
  });

  it('attaches pull-to-refresh to the actual scroll view and keeps committed content visible', async () => {
    const screen = await render(<ProgressScreen />);
    await screen.findByText('Progress');
    const scrollView = screen.getByTestId('progress-scroll');
    const refreshControl = scrollView.props.refreshControl;
    expect(refreshControl).toBeTruthy();
    expect(typeof refreshControl.props.onRefresh).toBe('function');

    await act(async () => {
      refreshControl.props.onRefresh();
    });

    expect(api.dashboard.summary).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Progress')).toBeTruthy();
  });

  it('persists the Progress mode switch before launcher icon synchronization completes', async () => {
    let resolveIcon: (() => void) | undefined;
    const iconSync = jest.requireMock('@/lib/app-icon')
      .syncLauncherIconToMode as jest.Mock;
    iconSync.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveIcon = () => resolve(true);
        }),
    );
    jest.spyOn(api.trackingPreferences, 'update').mockResolvedValue({
      ...progressRegressionNextModePreferences,
      dailyWaterGoalMl: 2000,
    });

    const screen = await render(<ProgressScreen />);
    const button = await screen.findByRole('button', {
      name: 'Switch tracking mode. Current mode is Simple.',
    });
    await userEvent.setup().press(button);

    await waitFor(() =>
      expect(api.trackingPreferences.update).toHaveBeenCalledWith({
        mode: 'complex',
        waterTrackingEnabled: true,
      }),
    );
    expect(
      screen.getByRole('button', {
        name: 'Switch tracking mode. Current mode is Complex.',
      }),
    ).toBeTruthy();
    expect(resolveIcon).toBeDefined();
    await act(async () => resolveIcon?.());
  });
});
