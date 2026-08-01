import { render, userEvent } from '../../../test/render';
import { DeleteAccountPanel } from '../account-deletion';

describe('DeleteAccountPanel', () => {
  it('requires the exact DELETE confirmation before enabling the destructive action', async () => {
    const screen = await render(
      <DeleteAccountPanel
        providerIds={['password']}
        actions={{
          reauthenticateWithPassword: jest.fn(),
          reauthenticateWithGoogle: jest.fn(),
          deleteAccount: jest.fn(),
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
      'DELETE',
    );
    await user.type(
      await screen.findByPlaceholderText('Current password'),
      'not-a-real-password',
    );
    expect(deleteButton.props.accessibilityState?.disabled).toBe(false);
  });

  it('does not call deletion when confirmation is cancelled', async () => {
    const deleteAccount = jest.fn();
    const screen = await render(
      <DeleteAccountPanel
        providerIds={['google.com']}
        actions={{
          reauthenticateWithPassword: jest.fn(),
          reauthenticateWithGoogle: jest.fn(),
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
});
