import { useEffect } from 'react';
import { act, render, userEvent } from '../../../test/render';
import AuthRecoveryRoute from '../recovery';
import { AuthRecoveryProvider } from '@/components/auth/auth-recovery-context';

describe('authentication recovery route', () => {
  it('renders one stable setup recovery screen whose actions require an explicit tap', async () => {
    const retry = jest.fn();
    const signOut = jest.fn();
    const mounted = jest.fn();
    const unmounted = jest.fn();
    function RecoveryScreen() {
      useEffect(() => {
        mounted();
        return unmounted;
      }, []);
      return <AuthRecoveryRoute />;
    }
    const user = userEvent.setup();
    const screen = await render(
      <AuthRecoveryProvider value={{ recovery: 'setup', retry, signOut }}>
        <RecoveryScreen />
      </AuthRecoveryProvider>,
    );

    expect(screen.getByText('We couldn’t load your account')).toBeTruthy();
    expect(
      screen.getByText(
        'You’re signed in, but we couldn’t retrieve your setup information. Check your connection and try again.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(retry).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();

    await act(async () =>
      screen.rerender(
        <AuthRecoveryProvider value={{ recovery: 'setup', retry, signOut }}>
          <RecoveryScreen />
        </AuthRecoveryProvider>,
      ),
    );
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Try again' }));
    await user.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
    screen.unmount();
  });

  it('does not expose recovery controls when the route has no recovery state', async () => {
    const screen = await render(
      <AuthRecoveryProvider
        value={{ recovery: undefined, retry: undefined, signOut: undefined }}
      >
        <AuthRecoveryRoute />
      </AuthRecoveryProvider>,
    );

    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    expect(screen.getByLabelText('Restoring your session')).toBeTruthy();
    screen.unmount();
  });
});
