import { render, userEvent } from '../../../test/render';
import { ForgotPasswordScreen } from '../forgot-password';
import { ProviderCancelledScreen } from '../provider-cancelled';
import { ProviderConflictScreen } from '../provider-conflict';
import { ResetEmailSentScreen } from '../reset-email-sent';
import { AuthLoadingScreen } from '../loading';

describe('supporting authentication screens', () => {
  it('submits forgot-password safely and exposes the approved reset state', async () => {
    const user = userEvent.setup();
    const sendPasswordReset = jest.fn().mockResolvedValue(undefined);
    const onSent = jest.fn();
    const screen = await render(
      <ForgotPasswordScreen
        actions={{ sendPasswordReset }}
        onSent={onSent}
        onSignIn={jest.fn()}
      />,
    );

    expect(await screen.findByText('Reset your password')).toBeTruthy();
    await user.type(
      await screen.findByPlaceholderText('you@example.com'),
      'josh@example.com',
    );
    await user.press(
      await screen.findByRole('button', { name: 'Send reset link' }),
    );

    expect(sendPasswordReset).toHaveBeenCalledWith('josh@example.com');
    expect(onSent).toHaveBeenCalledWith('josh@example.com');

    const resetScreen = await render(
      <ResetEmailSentScreen
        email="josh@example.com"
        onResend={jest.fn()}
        onSignIn={jest.fn()}
      />,
    );
    expect(await resetScreen.findByText('Reset link sent')).toBeTruthy();
    expect(
      await resetScreen.findByRole('button', { name: 'Return to sign in' }),
    ).toBeTruthy();
    expect(
      await resetScreen.findByRole('button', { name: 'Send another link' }),
    ).toBeTruthy();
  });

  it('renders cancellation and conflict recovery without raw provider details', async () => {
    const cancelled = await render(
      <ProviderCancelledScreen onTryAgain={jest.fn()} onUseEmail={jest.fn()} />,
    );
    expect(await cancelled.findByText('Sign-in cancelled')).toBeTruthy();
    expect(cancelled.queryByText(/Firebase|auth\/|credential/i)).toBeNull();

    const conflict = await render(
      <ProviderConflictScreen
        email="josh@example.com"
        onCancel={jest.fn()}
        onSignInWithEmail={jest.fn()}
      />,
    );
    expect(
      await conflict.findByText('This email already has an account'),
    ).toBeTruthy();
    expect(
      await conflict.findByRole('button', { name: 'Sign in with email' }),
    ).toBeTruthy();
  });

  it('renders the approved authentication loading state', async () => {
    const screen = await render(<AuthLoadingScreen />);

    expect(await screen.findByText('Signing you in…')).toBeTruthy();
    expect(
      await screen.findByText(
        'Restoring your secure session and account data.',
      ),
    ).toBeTruthy();
  });
});
