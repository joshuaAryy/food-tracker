const APPLE_SIGN_IN_FLAG = 'EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED';

export function parseAppleSignInEnabled(value: string | undefined): boolean {
  if (value === undefined) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;

  throw new Error(
    `${APPLE_SIGN_IN_FLAG} must be exactly "true" or "false" when set.`,
  );
}

export function isAppleSignInEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return parseAppleSignInEnabled(environment[APPLE_SIGN_IN_FLAG]);
}
