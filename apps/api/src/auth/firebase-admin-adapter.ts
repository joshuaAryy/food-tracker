import type { Auth, DecodedIdToken, UserRecord } from 'firebase-admin/auth';
import {
  AuthBoundaryError,
  type FirebaseAdminAuthAdapter,
  type FirebaseAdminUserStatus,
  type VerifiedFirebaseIdentity,
} from './types.js';

type FirebaseAuthPort = Pick<Auth, 'verifyIdToken' | 'getUser' | 'deleteUser'>;

function wholeEpochSeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new AuthBoundaryError('INVALID_AUTH_TOKEN');
  }
  return value;
}

function normalizedIdentity(decoded: DecodedIdToken): VerifiedFirebaseIdentity {
  const claims = decoded as unknown as Record<string, unknown>;
  const displayName =
    typeof claims.name === 'string' && claims.name.length > 0
      ? claims.name
      : null;
  const photoUrl =
    typeof decoded.picture === 'string' && decoded.picture.length > 0
      ? decoded.picture
      : null;

  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    emailVerified: decoded.email_verified === true,
    displayName,
    photoUrl,
    providerIds: Object.keys(decoded.firebase.identities),
    signInProvider: decoded.firebase.sign_in_provider ?? null,
    issuedAt: wholeEpochSeconds(decoded.iat),
    authenticatedAt: wholeEpochSeconds(decoded.auth_time),
  };
}

function normalizedUserStatus(user: UserRecord): FirebaseAdminUserStatus {
  return {
    uid: user.uid,
    disabled: user.disabled,
    tokensValidAfterTime: user.tokensValidAfterTime ?? null,
  };
}

export function createFirebaseAdminAuthAdapter(
  auth: FirebaseAuthPort,
): FirebaseAdminAuthAdapter {
  return {
    async verifyIdToken(token) {
      try {
        return normalizedIdentity(await auth.verifyIdToken(token, false));
      } catch (cause) {
        if (cause instanceof AuthBoundaryError) throw cause;
        throw new AuthBoundaryError('INVALID_AUTH_TOKEN', { cause });
      }
    },
    async getUser(uid) {
      try {
        return normalizedUserStatus(await auth.getUser(uid));
      } catch (cause) {
        throw new AuthBoundaryError('AUTH_TOKEN_REVOKED', { cause });
      }
    },
    async deleteUser(uid) {
      try {
        await auth.deleteUser(uid);
      } catch (cause) {
        if (
          typeof cause === 'object' &&
          cause !== null &&
          (cause as { code?: unknown }).code === 'auth/user-not-found'
        ) {
          return;
        }
        throw cause;
      }
    },
  };
}
