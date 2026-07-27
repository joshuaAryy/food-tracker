import { cleanup } from '@testing-library/react-native';
import { render, userEvent } from '../../../test/render';
import { AuthBrandLockup } from '../auth-brand-lockup';
import { AuthFormField } from '../auth-form-field';
import { AuthProviderButtons } from '../auth-provider-buttons';

describe('authentication primitives', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('renders the approved uncropped Simple brand lockup', async () => {
    const screen = await render(<AuthBrandLockup />);

    expect(await screen.findByLabelText('Food Tracker')).toBeTruthy();
    expect(await screen.findByText('Food Tracker')).toBeTruthy();
  });

  it('keeps Apple before Google and exposes provider actions accessibly', async () => {
    const onApple = jest.fn();
    const onGoogle = jest.fn();
    const user = userEvent.setup();
    const screen = await render(
      <AuthProviderButtons onApple={onApple} onGoogle={onGoogle} />,
    );

    const buttons = await screen.findAllByRole('button');
    expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual([
      'Continue with Apple',
      'Continue with Google',
    ]);

    await user.press(buttons[0]!);
    await user.press(buttons[1]!);
    expect(onApple).toHaveBeenCalledTimes(1);
    expect(onGoogle).toHaveBeenCalledTimes(1);
  });

  it('renders labeled fields with a hint and accessible error state', async () => {
    const screen = await render(
      <AuthFormField
        label="Password"
        placeholder="At least 8 characters"
        hint="Minimum 8 characters."
        error="Please check your password."
      />,
    );

    const input = await screen.findByPlaceholderText('At least 8 characters');
    expect(input.props.accessibilityLabel).toBe('Password');
    expect(input.props.accessibilityHint).toBe('Please check your password.');
    expect(await screen.findByText('Please check your password.')).toBeTruthy();
    expect(screen.queryByText('Minimum 8 characters.')).toBeNull();
  });
});
