import { AuthServiceError, normalizeAuthError } from './auth-errors';
import type { FirebaseAuthUser } from './auth-service';
import type { PendingProviderCredentialStore } from './pending-provider-credential';

export type GoogleAuthenticationResult =
  | { type: 'success'; idToken: string | null }
  | { type: 'cancelled' };

export interface GoogleAuthenticationAdapter {
  configure(options: { webClientId: string }): void;
  signIn(): Promise<GoogleAuthenticationResult>;
  createFirebaseCredential(idToken: string): unknown;
}

interface FirebaseCredentialSignIn {
  signInWithCredential(credential: unknown): Promise<FirebaseAuthUser>;
}

function providerErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export class GoogleAuthenticationService {
  private configuredClientId: string | undefined;

  constructor(
    private readonly authService: FirebaseCredentialSignIn,
    private readonly adapter: GoogleAuthenticationAdapter,
    private readonly pending?: PendingProviderCredentialStore<unknown>,
  ) {}

  async signIn(webClientId: string): Promise<FirebaseAuthUser> {
    const clientId = webClientId.trim();
    if (clientId === '') throw new AuthServiceError('configurationError');
    if (this.configuredClientId === undefined) {
      this.adapter.configure({ webClientId: clientId });
      this.configuredClientId = clientId;
    } else if (this.configuredClientId !== clientId) {
      throw new AuthServiceError('configurationError');
    }

    let result: GoogleAuthenticationResult;
    try {
      result = await this.adapter.signIn();
    } catch (error) {
      switch (providerErrorCode(error)) {
        case 'SIGN_IN_CANCELLED':
          throw new AuthServiceError('providerCancelled');
        case 'PLAY_SERVICES_NOT_AVAILABLE':
          throw new AuthServiceError('networkUnavailable');
        default:
          throw normalizeAuthError(error);
      }
    }

    if (result.type === 'cancelled') {
      throw new AuthServiceError('providerCancelled');
    }
    if (result.idToken === null || result.idToken === '') {
      throw new AuthServiceError('unknown');
    }

    const credential = this.adapter.createFirebaseCredential(result.idToken);
    try {
      return await this.authService.signInWithCredential(credential);
    } catch (error) {
      const normalized = normalizeAuthError(error);
      if (normalized.code === 'providerConflict') {
        this.pending?.set('google', credential);
      }
      throw normalized;
    }
  }
}
