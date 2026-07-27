import type { AuthErrorCode } from '@food-tracker/shared';

export type VerifiedFirebaseIdentity = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoUrl: string | null;
  providerIds: string[];
  signInProvider: string | null;
  issuedAt: number;
  authenticatedAt: number;
};

export interface FirebaseTokenVerifier {
  verifyIdToken(token: string): Promise<VerifiedFirebaseIdentity>;
}

export type FirebaseAdminUserStatus = {
  uid: string;
  disabled: boolean;
  tokensValidAfterTime: string | number | Date | null;
};

export interface FirebaseAdminAuthAdapter {
  verifyIdToken(token: string): Promise<VerifiedFirebaseIdentity>;
  getUser(uid: string): Promise<FirebaseAdminUserStatus>;
}

export interface FirebaseRevocationStatusService {
  assertActive(identity: VerifiedFirebaseIdentity): Promise<void>;
}

export class AuthBoundaryError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    options?: { cause?: unknown },
  ) {
    super('Firebase authentication failed.', options);
    this.name = 'AuthBoundaryError';
  }
}
