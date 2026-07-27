import { render, userEvent } from '../../../test/render';
import { AccountSignOutButton } from '../account-sign-out-button';

describe('account sign-out button', () => {
  it('invokes sign-out and exposes a disabled loading state', async () => {
    const user = userEvent.setup();
    let resolveSignOut: (() => void) | undefined;
    const onSignOut = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = resolve;
        }),
    );
    const screen = await render(<AccountSignOutButton onSignOut={onSignOut} />);

    await user.press(await screen.findByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(
      (await screen.findByRole('button', { name: 'Signing out' })).props
        .accessibilityState.disabled,
    ).toBe(true);

    resolveSignOut?.();
    expect(
      await screen.findByRole('button', { name: 'Sign out' }),
    ).toBeTruthy();
  });
});
