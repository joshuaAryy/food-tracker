import { describe, expect, it } from 'vitest';
import { parseAppleSignInEnabled } from './apple-sign-in-config';

describe('Apple sign-in availability configuration', () => {
  it('treats an unset value as disabled', () => {
    expect(parseAppleSignInEnabled(undefined)).toBe(false);
  });

  it('accepts exact false as disabled', () => {
    expect(parseAppleSignInEnabled('false')).toBe(false);
  });

  it('accepts exact true as enabled', () => {
    expect(parseAppleSignInEnabled('true')).toBe(true);
  });

  it.each(['TRUE', 'False', ' true', 'false ', '1', 'yes', ''])(
    'rejects malformed value %s',
    (value) => {
      expect(() => parseAppleSignInEnabled(value)).toThrow(
        'EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED must be exactly "true" or "false" when set.',
      );
    },
  );
});
