import { render, userEvent } from '../../../test/render';
import { CreateAccountScreen } from '../create-account';
import { VerifyEmailScreen } from '../verify-email';

describe('create account screen', () => {
  it('rejects seven characters and accepts eight without composition rules', async () => {
    const user = userEvent.setup();
    const createAccount = jest.fn().mockResolvedValue({ uid: 'firebase-user' });
    const screen = await render(
      <CreateAccountScreen
        appleSignInEnabled
        actions={{
          createAccount,
          onApple: jest.fn(),
          onGoogle: jest.fn(),
        }}
        onCreated={jest.fn()}
        onSignIn={jest.fn()}
      />,
    );

    await user.type(
      await screen.findByPlaceholderText('Joshua Aryeetey'),
      'Joshua',
    );
    await user.type(
      await screen.findByPlaceholderText('you@example.com'),
      'josh@example.com',
    );
    await user.type(
      await screen.findByPlaceholderText('At least 8 characters'),
      'abcdefg',
    );
    await user.press(
      await screen.findByRole('button', { name: 'Create account' }),
    );

    expect(createAccount).not.toHaveBeenCalled();
    expect(await screen.findByText('Minimum 8 characters.')).toBeTruthy();

    await user.type(
      await screen.findByPlaceholderText('At least 8 characters'),
      'h',
    );
    await user.press(
      await screen.findByRole('button', { name: 'Create account' }),
    );

    expect(createAccount).toHaveBeenCalledWith({
      name: 'Joshua',
      email: 'josh@example.com',
      password: 'abcdefgh',
    });
  });

  it('keeps provider order, has no consent control, and routes to verification after creation', async () => {
    const user = userEvent.setup();
    const onCreated = jest.fn();
    const screen = await render(
      <CreateAccountScreen
        appleSignInEnabled
        actions={{
          createAccount: jest.fn().mockResolvedValue({ uid: 'firebase-user' }),
          onApple: jest.fn(),
          onGoogle: jest.fn(),
        }}
        onCreated={onCreated}
        onSignIn={jest.fn()}
      />,
    );

    expect(await screen.findByText('Create your account')).toBeTruthy();
    expect(
      (await screen.findAllByRole('button')).map(
        (button) => button.props.accessibilityLabel,
      ),
    ).toEqual([
      'Continue with Apple',
      'Continue with Google',
      'Create account',
      'Sign in',
    ]);
    expect(screen.queryByText(/Terms|Privacy|consent/i)).toBeNull();

    await user.type(
      await screen.findByPlaceholderText('Joshua Aryeetey'),
      'Joshua',
    );
    await user.type(
      await screen.findByPlaceholderText('you@example.com'),
      'josh@example.com',
    );
    await user.type(
      await screen.findByPlaceholderText('At least 8 characters'),
      'abcdefgh',
    );
    await user.press(
      await screen.findByRole('button', { name: 'Create account' }),
    );

    expect(onCreated).toHaveBeenCalledWith('josh@example.com');
  });

  it('supports resend and refresh without entering the protected app early', async () => {
    const user = userEvent.setup();
    const resendVerification = jest.fn().mockResolvedValue(undefined);
    const refreshVerification = jest
      .fn()
      .mockResolvedValueOnce({ emailVerified: false })
      .mockResolvedValueOnce({ emailVerified: true });
    const onVerified = jest.fn();
    const screen = await render(
      <VerifyEmailScreen
        actions={{ resendVerification, refreshVerification }}
        email="josh@example.com"
        onDifferentEmail={jest.fn()}
        onVerified={onVerified}
      />,
    );

    expect(await screen.findByText('Check your inbox')).toBeTruthy();
    expect(
      await screen.findByText(
        'Check your inbox for the verification email. It may take a few minutes to arrive, and it could appear in your Junk or Spam folder.',
      ),
    ).toBeTruthy();
    await user.press(
      await screen.findByRole('button', { name: 'Resend verification email' }),
    );
    expect(resendVerification).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(
        'Verification email sent. Check your inbox; it may take a few minutes to arrive, and it could appear in your Junk or Spam folder.',
      ),
    ).toBeTruthy();

    await user.press(
      await screen.findByRole('button', { name: 'I’ve verified my email' }),
    );
    expect(onVerified).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Check your inbox and try again.'),
    ).toBeTruthy();

    await user.press(
      await screen.findByRole('button', { name: 'I’ve verified my email' }),
    );
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it('renders Google first and omits Apple when Apple sign-in is disabled', async () => {
    const screen = await render(
      <CreateAccountScreen
        appleSignInEnabled={false}
        actions={{
          createAccount: jest.fn(),
          onApple: jest.fn(),
          onGoogle: jest.fn(),
        }}
        onCreated={jest.fn()}
        onSignIn={jest.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Continue with Apple' }),
    ).toBeNull();
    expect(
      (await screen.findAllByRole('button')).map(
        (button) => button.props.accessibilityLabel,
      ),
    ).toEqual(['Continue with Google', 'Create account', 'Sign in']);
    expect(await screen.findByText('or')).toBeTruthy();
  });
});
