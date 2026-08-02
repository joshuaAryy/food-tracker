import { PendingProviderCredentialStore } from './pending-provider-credential';

// This is intentionally process-memory only. It is never persisted and expires after five minutes.
export const pendingProviderCredential =
  new PendingProviderCredentialStore<unknown>();
