export interface UserFacingErrorLike {
  code?: unknown;
}

const DEFAULT_ERROR_MESSAGE =
  'The request could not be completed. Please try again.';

const LOCAL_HOST_LITERAL = ['local', 'host'].join('');
const LOOPBACK_LITERAL = ['127', '0', '0', '1'].join('.');
const PRIVATE_ADDRESS_PATTERN = `(?:^|[^\\d])(?:${['10', '172', '192'].join('|')})\\.(?:\\d{1,3}\\.){2}\\d{1,3}`;
const USER_PATH_LITERAL = ['/', 'Users', '/'].join('');
const UNSAFE_COPY = new RegExp(
  [
    'https?:\\/\\/',
    LOCAL_HOST_LITERAL,
    LOOPBACK_LITERAL,
    PRIVATE_ADDRESS_PATTERN,
    '\\/api\\/v\\d',
    'DATABASE_URL',
    'FIREBASE_',
    'Authorization',
    'Bearer',
    'Prisma',
    'stack trace',
    'SELECT\\s+\\*',
    'railway\\.internal',
    USER_PATH_LITERAL,
  ].join('|'),
  'i',
);

function safeFallback(value: string): string {
  return value.length > 0 && value.length <= 240 && !UNSAFE_COPY.test(value)
    ? value
    : DEFAULT_ERROR_MESSAGE;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as UserFacingErrorLike).code;
  return typeof code === 'string' ? code : undefined;
}

export function toUserFacingError(
  error: unknown,
  fallback = DEFAULT_ERROR_MESSAGE,
): string {
  const safeMessage = safeFallback(fallback);
  const code = errorCode(error);

  if (code === 'NETWORK_ERROR' || error instanceof TypeError) {
    return 'We couldn’t connect. Check your connection and try again.';
  }

  if (code === 'NETWORK_TIMEOUT') {
    return 'The request took too long. Try again.';
  }

  if (code === 'VALIDATION_ERROR') {
    return 'Please check the highlighted values and try again.';
  }

  switch (code) {
    case 'invalidCredentials':
      return 'That email or password doesn’t match. Try again.';
    case 'emailAlreadyInUse':
      return 'That email is already in use. Try signing in instead.';
    case 'weakPassword':
      return 'Use at least 8 characters for your password.';
    case 'verificationRequired':
      return 'Please verify your email before continuing.';
    case 'tooManyRequests':
      return 'Too many attempts. Try again shortly.';
    case 'networkUnavailable':
      return 'We couldn’t connect. Check your connection and try again.';
    case 'providerCancelled':
      return 'Sign-in was cancelled. Try again when you’re ready.';
    case 'providerConflict':
      return 'This email already has an account. Sign in with the existing method.';
    case 'credentialExpired':
      return 'Your sign-in expired. Try again.';
    case 'sessionExpired':
      return 'Your session has expired. Please sign in again.';
    case 'configurationError':
      return 'Sign-in is temporarily unavailable. Try again later.';
    case 'unknown':
      return safeMessage;
    default:
      break;
  }

  switch (code) {
    case 'DATABASE_NOT_READY':
      return 'We couldn’t connect. Check your connection and try again.';
    case 'INVALID_RESPONSE':
      return 'We received an unexpected response. Try again.';
    case 'INTERNAL_SERVER_ERROR':
      return 'Something went wrong. Please try again.';
    case 'AI_UNAVAILABLE':
      return 'Food recognition is temporarily unavailable. Try again shortly.';
    case 'RATE_LIMITED':
      return 'Too many requests. Try again shortly.';
    case 'NOT_FOUND':
      return 'We couldn’t find that item. Refresh and try again.';
    case 'AUTHORIZATION_REQUIRED':
    case 'INVALID_AUTHORIZATION':
    case 'INVALID_AUTH_TOKEN':
    case 'AUTH_TOKEN_EXPIRED':
    case 'AUTH_TOKEN_REVOKED':
      return 'Your session has expired. Please sign in again.';
    case 'RECENT_AUTH_REQUIRED':
      return 'Please verify your identity again before deleting your account.';
    case 'ACCOUNT_DELETION_IN_PROGRESS':
      return 'Account deletion is already in progress. Try again shortly.';
    case 'EMAIL_VERIFICATION_REQUIRED':
      return 'Please verify your email before continuing.';
    case 'AUTH_CONFIGURATION_ERROR':
      return 'Sign-in is temporarily unavailable. Try again later.';
    case 'CANCELLED':
      return 'The action was cancelled.';
    case 'INVALID_DIMENSIONS':
      return 'The photo dimensions are not supported. Choose another image.';
    case 'NORMALIZATION_FAILED':
      return 'The photo could not be prepared. Try again.';
    case 'PHOTO_TOO_LARGE':
      return 'The photo is too large. Choose another image.';
    default:
      return safeMessage;
  }
}
