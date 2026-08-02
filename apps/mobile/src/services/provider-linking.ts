import { AuthServiceError, normalizeAuthError } from './auth-errors';
import {
  PendingProviderCredentialStore,
  type PendingProviderCredential,
} from './pending-provider-credential';
import type { FirebaseAuthUser } from './auth-service';

export interface ProviderLinkingAdapter {
  getCurrentUser(): FirebaseAuthUser | null;
  linkWithCredential(credential: unknown): Promise<FirebaseAuthUser>;
}

export class ProviderLinkingService<T> {
  constructor(
    private readonly pending: PendingProviderCredentialStore<T>,
    private readonly adapter: ProviderLinkingAdapter,
  ) {}

  async linkPendingCredential(
    authenticateExisting: () => Promise<FirebaseAuthUser>,
    now = Date.now(),
  ): Promise<FirebaseAuthUser> {
    const pendingCredential: PendingProviderCredential<T> | null =
      this.pending.get(now);
    if (pendingCredential === null) {
      throw new AuthServiceError('unknown');
    }

    try {
      await authenticateExisting();
      if (this.adapter.getCurrentUser() === null) {
        throw new AuthServiceError('sessionExpired');
      }
      const linkedUser = await this.adapter.linkWithCredential(
        pendingCredential.credential,
      );
      this.pending.clear('success');
      return linkedUser;
    } catch (error) {
      this.pending.clear('failure');
      throw error instanceof AuthServiceError
        ? error
        : normalizeAuthError(error);
    }
  }

  clear(reason: 'cancellation' | 'signOut' | 'background'): void {
    this.pending.clear(reason);
  }
}
