import { AuthServiceError } from '../../../services/auth-errors';
import { render, userEvent } from '../../../test/render';
import { SignInScreen } from '../sign-in';

describe('sign-in screen', () => {
  it('renders the approved provider-first form and calls injected actions', async () => {
    const user = userEvent.setup();
    const signInWithEmail = jest
      .fn()
      .mockResolvedValue({ uid: 'firebase-user' });
    const onApple = jest.fn().mockResolvedValue(undefined);
    const onGoogle = jest.fn().mockResolvedValue(undefined);
    const onCreateAccount = jest.fn();
    const onForgotPassword = jest.fn();

    const screen = await render(
      <SignInScreen
        actions={{ signInWithEmail, onApple, onGoogle }}
        onCreateAccount={onCreateAccount}
        onForgotPassword={onForgotPassword}
      />,
    );

    expect(await screen.findByText('Welcome back')).toBeTruthy();
    expect(
      (await screen.findAllByRole('button')).map(
        (button) => button.props.accessibilityLabel,
      ),
    ).toEqual([
      'Continue with Apple',
      'Continue with Google',
      'Forgot password?',
      'Sign in',
      'Create account',
    ]);
    expect(screen.queryByText(/Terms|Privacy|consent/i)).toBeNull();

    await user.type(
      await screen.findByPlaceholderText('you@example.com'),
      'josh@example.com',
    );
    await user.type(
      await screen.findByPlaceholderText('••••••••'),
      'password8',
    );
    await user.press(await screen.findByRole('button', { name: 'Sign in' }));

    expect(signInWithEmail).toHaveBeenCalledWith(
      'josh@example.com',
      'password8',
    );
  });

  it('shows safe local copy for normalized authentication failures', async () => {
    const user = userEvent.setup();
    const screen = await render(
      <SignInScreen
        actions={{
          signInWithEmail: jest
            .fn()
            .mockRejectedValue(new AuthServiceError('invalidCredentials')),
          onApple: jest.fn(),
          onGoogle: jest.fn(),
        }}
        onCreateAccount={jest.fn()}
        onForgotPassword={jest.fn()}
      />,
    );

    await user.type(
      await screen.findByPlaceholderText('you@example.com'),
      'josh@example.com',
    );
    await user.type(
      await screen.findByPlaceholderText('••••••••'),
      'password8',
    );
    await user.press(await screen.findByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText(
        'That email or password doesn’t match. Try again.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Firebase|auth\//i)).toBeNull();
  });

  it('routes provider conflicts to the dedicated recovery action', async () => {
    const user = userEvent.setup();
    const onProviderConflict = jest.fn();
    const screen = await render(
      <SignInScreen
        actions={{
          signInWithEmail: jest.fn(),
          onApple: jest
            .fn()
            .mockRejectedValue(new AuthServiceError('providerConflict')),
          onGoogle: jest.fn(),
        }}
        onCreateAccount={jest.fn()}
        onForgotPassword={jest.fn()}
        onProviderConflict={onProviderConflict}
      />,
    );

    await user.press(
      await screen.findByRole('button', { name: 'Continue with Apple' }),
    );

    expect(onProviderConflict).toHaveBeenCalledWith('');
    expect(screen.queryByText(/Firebase|auth\/|credential/i)).toBeNull();
  });
});
