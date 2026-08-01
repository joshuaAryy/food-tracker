import type { VerifiedFirebaseIdentity } from './types.js';

export const RECENT_AUTH_MAX_AGE_SECONDS = 5 * 60;

export function isRecentlyAuthenticated(
  identity: Pick<VerifiedFirebaseIdentity, 'authenticatedAt'>,
  now = Math.floor(Date.now() / 1000),
): boolean {
  const age = now - identity.authenticatedAt;
  return age >= 0 && age <= RECENT_AUTH_MAX_AGE_SECONDS;
}
