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
  deleteUser(uid: string): Promise<void>;
}

export interface FirebaseRevocationStatusService {
  assertActive(identity: VerifiedFirebaseIdentity): Promise<void>;
}

export type FirebaseVerificationFailureCategory =
  | 'missing_header'
  | 'malformed_header'
  | 'malformed_token'
  | 'invalid_signature'
  | 'invalid_audience'
  | 'invalid_issuer'
  | 'project_mismatch'
  | 'expired_token'
  | 'revoked_token'
  | 'disabled_user'
  | 'admin_configuration_error'
  | 'unknown_verification_failure';

export class AuthBoundaryError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    options?: {
      cause?: unknown;
      diagnosticCategory?: FirebaseVerificationFailureCategory;
    },
  ) {
    super('Firebase authentication failed.', options);
    this.name = 'AuthBoundaryError';
    this.diagnosticCategory = options?.diagnosticCategory;
  }

  readonly diagnosticCategory: FirebaseVerificationFailureCategory | undefined;
}
