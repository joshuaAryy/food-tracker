import { describe, expect, it, vi } from 'vitest';
import {
  AuthBoundaryError,
  createFirebaseRevocationStatusService,
  type FirebaseAdminAuthAdapter,
  type FirebaseAdminUserStatus,
  type VerifiedFirebaseIdentity,
} from '../src/auth/firebase-revocation-status.js';

function identity(
  uid: string,
  authenticatedAt: number,
  issuedAt = authenticatedAt,
): VerifiedFirebaseIdentity {
  return {
    uid,
    email: null,
    emailVerified: true,
    displayName: null,
    photoUrl: null,
    providerIds: ['google.com'],
    signInProvider: 'google.com',
    issuedAt,
    authenticatedAt,
  };
}

function adapterWith(
  getUser: FirebaseAdminAuthAdapter['getUser'],
): FirebaseAdminAuthAdapter {
  return {
    verifyIdToken: vi.fn(),
    getUser,
    deleteUser: vi.fn(),
  };
}

const activeUser = (uid: string): FirebaseAdminUserStatus => ({
  uid,
  disabled: false,
  tokensValidAfterTime: null,
});

describe('Firebase revocation status service', () => {
  it('performs one strict status lookup for a cached authentication session', async () => {
    const getUser = vi.fn().mockResolvedValue(activeUser('user-1'));
    const service = createFirebaseRevocationStatusService(
      adapterWith(getUser),
      {
        now: () => 0,
      },
    );

    await service.assertActive(identity('user-1', 100));
    await service.assertActive(identity('user-1', 100, 200));

    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('refreshes the strict lookup after five minutes', async () => {
    let now = 0;
    const getUser = vi.fn().mockResolvedValue(activeUser('user-1'));
    const service = createFirebaseRevocationStatusService(
      adapterWith(getUser),
      {
        now: () => now,
      },
    );

    await service.assertActive(identity('user-1', 100));
    now = 299_999;
    await service.assertActive(identity('user-1', 100));
    now = 300_000;
    await service.assertActive(identity('user-1', 100));

    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it.each([
    '1970-01-01T00:01:40.000Z',
    100,
    '100',
    new Date('1970-01-01T00:01:40.000Z'),
  ])('normalizes %s to the revocation second', async (tokensValidAfterTime) => {
    const getUser = vi.fn().mockResolvedValue({
      uid: 'user-1',
      disabled: false,
      tokensValidAfterTime,
    });
    const service = createFirebaseRevocationStatusService(
      adapterWith(getUser),
      {
        now: () => 0,
      },
    );

    await expect(
      service.assertActive(identity('user-1', 100)),
    ).rejects.toMatchObject({ code: 'AUTH_TOKEN_REVOKED' });
  });

  it('accepts authentication strictly after the revocation second', async () => {
    const getUser = vi.fn().mockResolvedValue({
      uid: 'user-1',
      disabled: false,
      tokensValidAfterTime: 100,
    });
    const service = createFirebaseRevocationStatusService(
      adapterWith(getUser),
      {
        now: () => 0,
      },
    );

    await expect(
      service.assertActive(identity('user-1', 101)),
    ).resolves.toBeUndefined();
  });

  it('rejects disabled users and does not cache the rejection', async () => {
    const getUser = vi.fn().mockResolvedValue({
      uid: 'user-1',
      disabled: true,
      tokensValidAfterTime: null,
    });
    const service = createFirebaseRevocationStatusService(
      adapterWith(getUser),
      {
        now: () => 0,
      },
    );

    await expect(
      service.assertActive(identity('user-1', 100)),
    ).rejects.toMatchObject({
      code: 'AUTH_TOKEN_REVOKED',
    });
    await expect(
      service.assertActive(identity('user-1', 100)),
    ).rejects.toMatchObject({
      code: 'AUTH_TOKEN_REVOKED',
    });
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it('does not cache deleted-user lookup failures', async () => {
    const getUser = vi.fn().mockRejectedValue(
      Object.assign(new Error('private user detail'), {
        code: 'auth/user-not-found',
      }),
    );
    const service = createFirebaseRevocationStatusService(
      adapterWith(getUser),
      {
        now: () => 0,
      },
    );

    await expect(
      service.assertActive(identity('user-1', 100)),
    ).rejects.toBeInstanceOf(AuthBoundaryError);
    await expect(
      service.assertActive(identity('user-1', 100)),
    ).rejects.toMatchObject({
      code: 'AUTH_TOKEN_REVOKED',
    });
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it('uses separate cache entries for reauthentication and evicts the oldest entry', async () => {
    const getUser = vi.fn(async (uid: string) => activeUser(uid));
    const service = createFirebaseRevocationStatusService(
      adapterWith(getUser),
      {
        now: () => 0,
        maxEntries: 2,
      },
    );

    await service.assertActive(identity('user-1', 100));
    await service.assertActive(identity('user-1', 101));
    await service.assertActive(identity('user-2', 100));
    await service.assertActive(identity('user-1', 100));

    expect(getUser).toHaveBeenCalledTimes(4);
  });
});
