import { describe, expect, it, vi } from 'vitest';
import {
  AccountDeletionProviderError,
  permanentlyDeleteAccount,
  type AccountDeletionRepository,
} from '../src/auth/account-deletion.js';
import {
  RECENT_AUTH_MAX_AGE_SECONDS,
  isRecentlyAuthenticated,
} from '../src/auth/recent-auth.js';

function repositoryWith(
  overrides: Partial<AccountDeletionRepository> = {},
): AccountDeletionRepository {
  return {
    prepare: vi.fn().mockResolvedValue({
      firebaseUid: 'firebase-user-1',
      applicationUserId: 'application-user-1',
    }),
    complete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('account deletion coordinator', () => {
  it('deletes only the verified subject and clears coordination state', async () => {
    const repository = repositoryWith();
    const deleteFirebaseUser = vi.fn().mockResolvedValue(undefined);

    await permanentlyDeleteAccount({
      firebaseUid: 'firebase-user-1',
      repository,
      deleteFirebaseUser,
    });

    expect(repository.prepare).toHaveBeenCalledWith('firebase-user-1');
    expect(deleteFirebaseUser).toHaveBeenCalledWith('firebase-user-1');
    expect(repository.complete).toHaveBeenCalledWith('firebase-user-1');
  });

  it('does not report success when Firebase deletion fails and preserves retry state', async () => {
    const repository = repositoryWith();
    const deleteFirebaseUser = vi
      .fn()
      .mockRejectedValue(new AccountDeletionProviderError());

    await expect(
      permanentlyDeleteAccount({
        firebaseUid: 'firebase-user-1',
        repository,
        deleteFirebaseUser,
      }),
    ).rejects.toBeInstanceOf(AccountDeletionProviderError);
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it('retries a pending deletion without recreating application identity', async () => {
    const repository = repositoryWith();
    const deleteFirebaseUser = vi
      .fn()
      .mockRejectedValueOnce(new AccountDeletionProviderError())
      .mockResolvedValueOnce(undefined);

    await expect(
      permanentlyDeleteAccount({
        firebaseUid: 'firebase-user-1',
        repository,
        deleteFirebaseUser,
      }),
    ).rejects.toBeInstanceOf(AccountDeletionProviderError);

    await permanentlyDeleteAccount({
      firebaseUid: 'firebase-user-1',
      repository,
      deleteFirebaseUser,
    });

    expect(repository.prepare).toHaveBeenCalledTimes(2);
    expect(repository.complete).toHaveBeenCalledTimes(1);
  });

  it('accepts an idempotent provider deletion result', async () => {
    const repository = repositoryWith();
    const deleteFirebaseUser = vi.fn().mockResolvedValue(undefined);

    await permanentlyDeleteAccount({
      firebaseUid: 'firebase-user-1',
      repository,
      deleteFirebaseUser,
    });
    await permanentlyDeleteAccount({
      firebaseUid: 'firebase-user-1',
      repository,
      deleteFirebaseUser,
    });

    expect(repository.complete).toHaveBeenCalledTimes(2);
  });
});

describe('recent authentication policy', () => {
  it('accepts auth_time inside the centralized freshness window', () => {
    expect(
      isRecentlyAuthenticated(
        { authenticatedAt: 1_000 },
        1_000 + RECENT_AUTH_MAX_AGE_SECONDS,
      ),
    ).toBe(true);
  });

  it('rejects auth_time outside the freshness window', () => {
    expect(
      isRecentlyAuthenticated(
        { authenticatedAt: 1_000 },
        1_001 + RECENT_AUTH_MAX_AGE_SECONDS,
      ),
    ).toBe(false);
  });
});
