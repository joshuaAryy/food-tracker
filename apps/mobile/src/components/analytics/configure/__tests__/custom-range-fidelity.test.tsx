import { act, render, userEvent } from '@/test/render';
import { View } from 'react-native';
import { api } from '@/lib/api-client';
import CustomRangeScreen from '@/app/trends/custom-range';

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
    savedViewId: 'saved-1',
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

describe('Custom Range sheet fidelity', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockReplace.mockReset();
    jest.spyOn(api.analytics, 'trend').mockResolvedValue({
      firstEligibleDate: '2026-06-01',
      today: '2026-08-01',
    } as never);
  });

  it('renders the full-history rail, exposes endpoint interaction, and preserves saved-view context on Apply', async () => {
    const screen = await render(
      <View testID="compact-320-custom-range" style={{ width: 320 }}>
        <CustomRangeScreen />
      </View>,
    );
    expect(screen.getByTestId('compact-320-custom-range').props.style).toEqual({
      width: 320,
    });
    let rail = await screen.findByLabelText('Custom date range history rail');
    expect(screen.getByText('FIRST LOG')).toBeTruthy();
    expect(screen.getByText('TODAY')).toBeTruthy();
    expect(screen.getByText(/Drag handles to select/)).toBeTruthy();
    expect(rail.props.accessibilityRole).toBe('adjustable');
    expect(rail.props.accessibilityValue.text).toContain('2026-07-03');

    await act(async () => {
      rail.props.onLayout({ nativeEvent: { layout: { width: 280 } } });
    });
    rail = screen.getByLabelText('Custom date range history rail');
    await act(async () => {
      const touchHistory = (pageX: number, previousPageX = pageX) => ({
        touchBank: [
          {
            touchActive: true,
            currentTimeStamp: 2,
            currentPageX: pageX,
            currentPageY: 0,
            previousPageX,
            previousPageY: 0,
          },
        ],
        numberActiveTouches: 1,
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: 2,
      });
      rail.props.onResponderGrant({
        nativeEvent: { locationX: 252 },
        touchHistory: touchHistory(252),
      });
      rail.props.onResponderMove({
        nativeEvent: { locationX: 224 },
        touchHistory: touchHistory(224, 252),
      });
    });

    expect(rail.props.accessibilityValue.text).not.toBe(
      '2026-07-03 through 2026-08-01',
    );
    await userEvent.setup().press(
      screen.getByRole('button', { name: 'Apply range' }),
    );
    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/trends/configure',
        params: expect.objectContaining({ savedViewId: 'saved-1' }),
      }),
    );
  });

  it('zooms the selected range when the rail receives a two-finger gesture', async () => {
    const screen = await render(
      <View testID="compact-320-custom-range" style={{ width: 320 }}>
        <CustomRangeScreen />
      </View>,
    );
    let rail = await screen.findByLabelText('Custom date range history rail');
    const touch = (locationX: number) => ({ locationX });
    const touchHistory = (
      current: readonly number[],
      previous: readonly number[],
      timestamp: number,
    ) => ({
      touchBank: current.map((pageX, index) => ({
        touchActive: true,
        currentTimeStamp: timestamp,
        currentPageX: pageX,
        currentPageY: 0,
        previousPageX: previous[index] ?? pageX,
        previousPageY: 0,
      })),
      numberActiveTouches: current.length,
      indexOfSingleActiveTouch: current.length === 1 ? 0 : -1,
      mostRecentTimeStamp: timestamp,
    });

    await act(async () => {
      rail.props.onLayout({ nativeEvent: { layout: { width: 280 } } });
    });

    rail.props.onResponderGrant({
      nativeEvent: {
        locationX: 140,
        touches: [touch(140)],
      },
      touchHistory: touchHistory([140], [140], 1),
    });
    await act(async () => {
      rail.props.onResponderMove({
        nativeEvent: {
          locationX: 140,
          touches: [touch(112), touch(168)],
        },
        touchHistory: touchHistory([112, 168], [112, 168], 2),
      });
    });
    rail = screen.getByLabelText('Custom date range history rail');
    await act(async () => {
      rail.props.onResponderMove({
        nativeEvent: {
          locationX: 140,
          touches: [touch(84), touch(196)],
        },
        touchHistory: touchHistory([84, 196], [112, 168], 3),
      });
    });

    rail = screen.getByLabelText('Custom date range history rail');
    expect(rail.props.accessibilityValue.text).toBe(
      '2026-06-24 through 2026-07-08',
    );
  });
});
