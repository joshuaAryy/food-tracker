import { render, userEvent } from '../../../test/render';
import { DeleteAccountPanel } from '../account-deletion';

describe('DeleteAccountPanel', () => {
  it('requires the exact DELETE confirmation before enabling the destructive action', async () => {
    const deleteAccount = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <DeleteAccountPanel
        actions={{
          deleteAccount,
        }}
      />,
    );
    const user = userEvent.setup();

    await user.press(
      await screen.findByRole('button', { name: 'Delete account' }),
    );
    await user.press(
      await screen.findByRole('button', { name: 'Continue to delete account' }),
    );

    const deleteButton = await screen.findByRole('button', {
      name: 'Permanently delete account',
    });
    expect(deleteButton.props.accessibilityState?.disabled).toBe(true);

    await user.type(
      await screen.findByPlaceholderText('Type DELETE'),
      'delete',
    );
    expect(deleteButton.props.accessibilityState?.disabled).toBe(true);
    expect(screen.queryByPlaceholderText('Current password')).toBeNull();

    await user.clear(await screen.findByPlaceholderText('Type DELETE'));
    await user.type(
      await screen.findByPlaceholderText('Type DELETE'),
      'DELETE',
    );
    expect(deleteButton.props.accessibilityState?.disabled).toBe(false);

    await user.press(deleteButton);
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });

  it('does not call deletion when confirmation is cancelled', async () => {
    const deleteAccount = jest.fn();
    const screen = await render(
      <DeleteAccountPanel
        actions={{
          deleteAccount,
        }}
      />,
    );
    const user = userEvent.setup();

    await user.press(
      await screen.findByRole('button', { name: 'Delete account' }),
    );
    await user.press(await screen.findByRole('button', { name: 'Cancel' }));

    expect(deleteAccount).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('Type DELETE')).toBeNull();
  });

  it('keeps the failure state usable after deletion fails', async () => {
    const deleteAccount = jest
      .fn()
      .mockRejectedValue(new Error('request failed'));
    const screen = await render(
      <DeleteAccountPanel actions={{ deleteAccount }} />,
    );
    const user = userEvent.setup();

    await user.press(
      await screen.findByRole('button', { name: 'Delete account' }),
    );
    await user.press(
      await screen.findByRole('button', { name: 'Continue to delete account' }),
    );
    await user.type(
      await screen.findByPlaceholderText('Type DELETE'),
      'DELETE',
    );
    await user.press(
      await screen.findByRole('button', { name: 'Permanently delete account' }),
    );

    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(
      await screen.findByRole('button', { name: 'Permanently delete account' }),
    ).toBeTruthy();
  });

  it('offers password reauthentication when deletion requires recent identity verification', async () => {
    const deleteAccount = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('recent auth required'), {
          code: 'RECENT_AUTH_REQUIRED',
        }),
      )
      .mockResolvedValueOnce(undefined);
    const reauthenticateWithPassword = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <DeleteAccountPanel
        actions={{
          deleteAccount,
          providerIds: ['password'],
          reauthenticateWithPassword,
        }}
      />,
    );
    const user = userEvent.setup();

    await user.press(
      await screen.findByRole('button', { name: 'Delete account' }),
    );
    await user.press(
      await screen.findByRole('button', { name: 'Continue to delete account' }),
    );
    await user.type(
      await screen.findByPlaceholderText('Type DELETE'),
      'DELETE',
    );
    await user.press(
      await screen.findByRole('button', { name: 'Permanently delete account' }),
    );

    const password = await screen.findByPlaceholderText('Current password');
    expect(
      await screen.findByRole('button', { name: 'Verify identity' }),
    ).toBeTruthy();
    await user.type(password, 'test-password');
    await user.press(
      await screen.findByRole('button', { name: 'Verify identity' }),
    );

    expect(reauthenticateWithPassword).toHaveBeenCalledWith('test-password');
    expect(deleteAccount).toHaveBeenCalledTimes(2);
  });
});
