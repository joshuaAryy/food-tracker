import { AccessibilityInfo, Animated, AppState } from 'react-native';
import { act, render, waitFor } from '../../../test/render';
import { AuthLoadingScreen } from '../loading';

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockReset = jest.fn();
const mockRemoveReduceMotion = jest.fn();
const mockRemoveAppState = jest.fn();
let appStateListener: ((state: string) => void) | undefined;
let reduceMotionListener: ((enabled: boolean) => void) | undefined;
let mockReduceMotion: jest.SpyInstance;

function loopAnimation() {
  return {
    start: mockStart,
    stop: mockStop,
    reset: mockReset,
  } as unknown as Animated.CompositeAnimation;
}

describe('authentication loading motion', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockStart.mockClear();
    mockStop.mockClear();
    mockReset.mockClear();
    mockRemoveReduceMotion.mockClear();
    mockRemoveAppState.mockClear();
    appStateListener = undefined;
    reduceMotionListener = undefined;
    mockReduceMotion = jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      event: string,
      listener: unknown,
    ) => {
      if (event === 'reduceMotionChanged') {
        reduceMotionListener = listener as (enabled: boolean) => void;
      }
      return { remove: mockRemoveReduceMotion } as never;
    }) as never);
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_, listener) => {
        appStateListener = listener as (state: string) => void;
        return { remove: mockRemoveAppState };
      });
    jest.spyOn(Animated, 'loop').mockImplementation(loopAnimation);
  });

  it('renders fixed-size indicator wrappers while animation styles remain visual-only', async () => {
    const screen = await render(<AuthLoadingScreen />);

    expect(screen.getByLabelText('Restoring your session')).toBeTruthy();
    expect(screen.getByTestId('auth-loading-dot-1')).toBeTruthy();
    expect(screen.getByTestId('auth-loading-dot-2')).toBeTruthy();
    expect(screen.getByTestId('auth-loading-dot-3')).toBeTruthy();
    expect(screen.getByTestId('auth-loading-dots').props.style).toMatchObject({
      width: 52,
      height: 12,
    });
    expect(
      screen.getByTestId('auth-loading-spinner-wrapper').props.style,
    ).toMatchObject({ width: 20, height: 20 });
    expect(screen.getByTestId('auth-loading-dot-1').props.style).toEqual({
      opacity: expect.anything(),
    });
    expect(
      screen.getByTestId('auth-loading-spinner-rotator').props.style,
    ).toEqual({ transform: expect.anything() });
    await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(2));
    await act(async () => screen.unmount());
  });

  it('stops loops and subscriptions on unmount without recreating them on rerender', async () => {
    const screen = await render(<AuthLoadingScreen />);

    await act(async () => screen.rerender(<AuthLoadingScreen />));
    await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('auth-loading-dot-1')).toBeTruthy();
    expect(screen.getByTestId('auth-loading-dot-2')).toBeTruthy();
    expect(screen.getByTestId('auth-loading-dot-3')).toBeTruthy();

    await act(async () => screen.unmount());
    expect(mockStop).toHaveBeenCalledTimes(2);
    expect(mockRemoveReduceMotion).toHaveBeenCalledTimes(1);
    expect(mockRemoveAppState).toHaveBeenCalledTimes(1);
  });

  it('uses restrained static progress when Reduce Motion is enabled', async () => {
    mockReduceMotion.mockResolvedValue(true);
    const screen = await render(<AuthLoadingScreen />);

    expect(screen.getByLabelText('Restoring your session')).toBeTruthy();
    await waitFor(() => expect(mockStart).not.toHaveBeenCalled());
    await act(async () => screen.unmount());
  });

  it('preserves the same fixed wrapper structure when Reduce Motion changes', async () => {
    const screen = await render(<AuthLoadingScreen />);

    const dots = screen.getByTestId('auth-loading-dots');
    const spinner = screen.getByTestId('auth-loading-spinner-wrapper');
    await act(async () => reduceMotionListener?.(true));

    expect(screen.getByTestId('auth-loading-dot-1')).toBeTruthy();
    expect(screen.getByTestId('auth-loading-dot-2')).toBeTruthy();
    expect(screen.getByTestId('auth-loading-dot-3')).toBeTruthy();
    expect(screen.getByTestId('auth-loading-dots').props.style).toEqual(
      dots.props.style,
    );
    expect(
      screen.getByTestId('auth-loading-spinner-wrapper').props.style,
    ).toEqual(spinner.props.style);
    await act(async () => screen.unmount());
  });

  it('pauses in the background and resumes once when active again', async () => {
    const screen = await render(<AuthLoadingScreen />);

    await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(2));
    await act(async () => appStateListener?.('background'));
    await waitFor(() => expect(mockStop).toHaveBeenCalledTimes(2));

    await act(async () => appStateListener?.('active'));
    await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(4));
    expect(Animated.loop).toHaveBeenCalledTimes(2);
    await act(async () => screen.unmount());
  });
});
