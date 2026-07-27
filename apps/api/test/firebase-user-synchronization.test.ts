import { describe, expect, it, vi } from 'vitest';
import {
  synchronizeFirebaseUser,
  type FirebaseUserRepository,
  type SyncedFirebaseUser,
} from '../src/auth/synchronize-firebase-user.js';
import type { VerifiedFirebaseIdentity } from '../src/auth/types.js';

const identity: VerifiedFirebaseIdentity = {
  uid: 'firebase-user-1',
  email: 'new@example.com',
  emailVerified: true,
  displayName: 'Provider Name',
  photoUrl: 'https://example.com/provider.png',
  providerIds: ['password', 'password', 'google.com'],
  signInProvider: 'google.com',
  issuedAt: 200,
  authenticatedAt: 100,
};

const user = (id: string, firebaseUid: string | null): SyncedFirebaseUser => ({
  id,
  firebaseUid,
  email: 'old@example.com',
  firebaseDisplayName: null,
  firebasePhotoUrl: null,
  firebaseProviderIds: [],
});

function repositoryWith(
  overrides: Partial<FirebaseUserRepository> = {},
): FirebaseUserRepository {
  return {
    findByFirebaseUid: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(user('application-user-1', identity.uid)),
    updateById: vi
      .fn()
      .mockResolvedValue(user('application-user-1', identity.uid)),
    ...overrides,
  };
}

describe('Firebase application-user synchronization', () => {
  it('creates a new application user only from Firebase UID', async () => {
    const repository = repositoryWith();

    await synchronizeFirebaseUser(repository, identity);

    expect(repository.findByFirebaseUid).toHaveBeenCalledWith(identity.uid);
    expect(repository.create).toHaveBeenCalledWith({
      firebaseUid: identity.uid,
      email: identity.email,
      firebaseDisplayName: identity.displayName,
      firebasePhotoUrl: identity.photoUrl,
      firebaseProviderIds: ['password', 'google.com'],
    });
  });

  it('does not attach an existing mock user by matching email', async () => {
    const repository = repositoryWith();

    await synchronizeFirebaseUser(repository, {
      ...identity,
      email: 'existing-mock@example.com',
    });

    expect(repository.findByFirebaseUid).toHaveBeenCalledWith(identity.uid);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ firebaseUid: identity.uid }),
    );
    expect(repository.updateById).not.toHaveBeenCalled();
  });

  it('updates provider metadata for an existing Firebase user without touching profile data', async () => {
    const existing = user('application-user-1', identity.uid);
    const repository = repositoryWith({
      findByFirebaseUid: vi.fn().mockResolvedValue(existing),
    });

    await synchronizeFirebaseUser(repository, identity);

    expect(repository.updateById).toHaveBeenCalledWith(existing.id, {
      email: identity.email,
      firebaseDisplayName: identity.displayName,
      firebasePhotoUrl: identity.photoUrl,
      firebaseProviderIds: ['password', 'google.com'],
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rereads by Firebase UID after a concurrent unique conflict', async () => {
    const racingUser = user('application-user-2', identity.uid);
    const repository = repositoryWith({
      findByFirebaseUid: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(racingUser),
      create: vi.fn().mockRejectedValue({ code: 'P2002' }),
    });

    await synchronizeFirebaseUser(repository, identity);

    expect(repository.findByFirebaseUid).toHaveBeenNthCalledWith(
      2,
      identity.uid,
    );
    expect(repository.updateById).toHaveBeenCalledWith(
      racingUser.id,
      expect.objectContaining({ email: identity.email }),
    );
  });
});
