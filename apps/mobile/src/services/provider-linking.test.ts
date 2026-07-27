import { describe, expect, it, vi } from 'vitest';
import { AuthServiceError } from './auth-errors';
import { PendingProviderCredentialStore } from './pending-provider-credential';
import {
  ProviderLinkingService,
  type ProviderLinkingAdapter,
} from './provider-linking';
import type { FirebaseAuthUser } from './auth-service';

const linkedUser = { uid: 'one-firebase-uid' } as FirebaseAuthUser;

function adapterWith(
  overrides: Partial<ProviderLinkingAdapter> = {},
): ProviderLinkingAdapter {
  return {
    getCurrentUser: vi.fn().mockReturnValue(linkedUser),
    linkWithCredential: vi.fn().mockResolvedValue(linkedUser),
    ...overrides,
  };
}

describe('provider linking coordinator', () => {
  it('authenticates the existing method, links one pending credential, and clears it', async () => {
    const pending = new PendingProviderCredentialStore<string>();
    pending.set('apple', 'private-credential', 1_000);
    const adapter = adapterWith();
    const authenticateExisting = vi.fn().mockResolvedValue(linkedUser);
    const service = new ProviderLinkingService(pending, adapter);

    await expect(
      service.linkPendingCredential(authenticateExisting, 1_001),
    ).resolves.toBe(linkedUser);

    expect(authenticateExisting).toHaveBeenCalledTimes(1);
    expect(adapter.linkWithCredential).toHaveBeenCalledWith(
      'private-credential',
    );
    expect(pending.get(1_002)).toBeNull();
  });

  it('does not link without an authenticated existing Firebase user', async () => {
    const pending = new PendingProviderCredentialStore<string>();
    pending.set('google', 'private-credential', 1_000);
    const adapter = adapterWith({
      getCurrentUser: vi.fn().mockReturnValue(null),
    });
    const service = new ProviderLinkingService(pending, adapter);

    await expect(
      service.linkPendingCredential(vi.fn(), 1_001),
    ).rejects.toMatchObject({ code: 'sessionExpired' });
    expect(adapter.linkWithCredential).not.toHaveBeenCalled();
    expect(pending.get(1_002)).toBeNull();
  });

  it('clears the pending credential when linking fails without exposing provider details', async () => {
    const pending = new PendingProviderCredentialStore<string>();
    pending.set('google', 'private-credential', 1_000);
    const adapter = adapterWith({
      linkWithCredential: vi
        .fn()
        .mockRejectedValue(new Error('credential-private-provider-detail')),
    });
    const service = new ProviderLinkingService(pending, adapter);

    await expect(
      service.linkPendingCredential(vi.fn(), 1_001),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof AuthServiceError &&
        error.code === 'unknown' &&
        !error.message.includes('credential-private-provider-detail'),
    );
    expect(pending.get(1_002)).toBeNull();
  });
});
