export type ProviderName = 'apple' | 'google';
export type PendingCredentialClearReason =
  | 'success'
  | 'failure'
  | 'cancellation'
  | 'signOut'
  | 'background';

export type PendingProviderCredential<T> = {
  provider: ProviderName;
  credential: T;
  createdAt: number;
  expiresAt: number;
};

const PENDING_CREDENTIAL_TTL_MS = 5 * 60 * 1000;

export class PendingProviderCredentialStore<T> {
  private pending: PendingProviderCredential<T> | null = null;

  set(provider: ProviderName, credential: T, now = Date.now()): void {
    this.pending = {
      provider,
      credential,
      createdAt: now,
      expiresAt: now + PENDING_CREDENTIAL_TTL_MS,
    };
  }

  get(now = Date.now()): PendingProviderCredential<T> | null {
    if (this.pending === null) return null;
    if (this.pending.expiresAt <= now) {
      this.pending = null;
      return null;
    }
    return this.pending;
  }

  clear(reason: PendingCredentialClearReason): void {
    void reason;
    this.pending = null;
  }
}
