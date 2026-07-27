import { generateAppleNonce } from '../lib/auth-nonce';
import { AuthServiceError, normalizeAuthError } from './auth-errors';
import type { FirebaseAuthUser } from './auth-service';
import type { PendingProviderCredentialStore } from './pending-provider-credential';

export type AppleAuthenticationResult = {
  identityToken: string | null;
  email: string | null;
  fullName: {
    givenName: string | null;
    familyName: string | null;
  } | null;
};

export interface AppleAuthenticationAdapter {
  randomBytes(length: number): Promise<Uint8Array>;
  digest(rawNonce: string): Promise<string>;
  signIn(input: { nonce: string }): Promise<AppleAuthenticationResult>;
  createFirebaseCredential(identityToken: string, rawNonce: string): unknown;
}

interface FirebaseCredentialSignIn {
  signInWithCredential(credential: unknown): Promise<FirebaseAuthUser>;
}

function providerErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function fullName(result: AppleAuthenticationResult): string | null {
  if (result.fullName === null) return null;
  const value = [result.fullName.givenName, result.fullName.familyName]
    .filter((part): part is string => typeof part === 'string')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .join(' ');
  return value === '' ? null : value;
}

export async function signInWithApple(
  authService: FirebaseCredentialSignIn,
  adapter: AppleAuthenticationAdapter,
  pending?: PendingProviderCredentialStore<unknown>,
): Promise<FirebaseAuthUser> {
  const { rawNonce, hashedNonce } = await generateAppleNonce(
    adapter.randomBytes,
    adapter.digest,
  );

  let result: AppleAuthenticationResult;
  try {
    result = await adapter.signIn({ nonce: hashedNonce });
  } catch (error) {
    if (providerErrorCode(error) === 'ERR_REQUEST_CANCELED') {
      throw new AuthServiceError('providerCancelled');
    }
    throw normalizeAuthError(error);
  }

  if (result.identityToken === null || result.identityToken === '') {
    throw new AuthServiceError('unknown');
  }

  const credential = adapter.createFirebaseCredential(
    result.identityToken,
    rawNonce,
  );
  let user: FirebaseAuthUser;
  try {
    user = await authService.signInWithCredential(credential);
  } catch (error) {
    const normalized = normalizeAuthError(error);
    if (normalized.code === 'providerConflict') {
      pending?.set('apple', credential);
    }
    throw normalized;
  }
  const providerName = fullName(result);
  if (providerName !== null && user.displayName === null) {
    await user.updateProfile({ displayName: providerName });
  }
  return user;
}
