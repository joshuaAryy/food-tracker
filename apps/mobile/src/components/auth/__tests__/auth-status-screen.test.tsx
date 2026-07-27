import { cleanup } from '@testing-library/react-native';
import { render } from '../../../test/render';
import { AuthStatusScreen } from '../auth-status-screen';

describe('authentication status screen', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('renders safe supporting-state actions without exposing implementation data', async () => {
    const screen = await render(
      <AuthStatusScreen
        icon="success"
        title="Reset link sent"
        message="Check your inbox for a password reset link."
        primaryLabel="Return to sign in"
        secondaryLabel="Send another link"
        onPrimaryPress={jest.fn()}
        onSecondaryPress={jest.fn()}
      />,
    );

    expect(await screen.findByText('Reset link sent')).toBeTruthy();
    expect(
      await screen.findByRole('button', { name: 'Return to sign in' }),
    ).toBeTruthy();
    expect(
      await screen.findByRole('button', { name: 'Send another link' }),
    ).toBeTruthy();
    expect(
      screen.queryByText(/API|localhost|Prisma|Firebase|Bearer/i),
    ).toBeNull();
  });
});
