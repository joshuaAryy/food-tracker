import { Prisma, type PrismaClient } from '@prisma/client';
import { AuthBoundaryError, type VerifiedFirebaseIdentity } from './types.js';

export type SyncedFirebaseUser = {
  id: string;
  firebaseUid: string | null;
  email: string | null;
  firebaseDisplayName: string | null;
  firebasePhotoUrl: string | null;
  firebaseProviderIds: string[];
};

type FirebaseUserMetadata = Omit<SyncedFirebaseUser, 'id' | 'firebaseUid'>;
type FirebaseUserCreateData = FirebaseUserMetadata & { firebaseUid: string };

export interface FirebaseUserRepository {
  findByFirebaseUid(firebaseUid: string): Promise<SyncedFirebaseUser | null>;
  create(data: FirebaseUserCreateData): Promise<SyncedFirebaseUser>;
  updateById(
    id: string,
    data: FirebaseUserMetadata,
  ): Promise<SyncedFirebaseUser>;
}

const userSelect = {
  id: true,
  firebaseUid: true,
  email: true,
  firebaseDisplayName: true,
  firebasePhotoUrl: true,
  firebaseProviderIds: true,
} as const;

type SelectedUser = {
  [key in keyof typeof userSelect]: key extends keyof SyncedFirebaseUser
    ? SyncedFirebaseUser[key]
    : never;
};

function selectedUser(user: SelectedUser): SyncedFirebaseUser {
  return {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    firebaseDisplayName: user.firebaseDisplayName,
    firebasePhotoUrl: user.firebasePhotoUrl,
    firebaseProviderIds: user.firebaseProviderIds,
  };
}

export function createPrismaFirebaseUserRepository(
  client: PrismaClient,
): FirebaseUserRepository {
  return {
    async findByFirebaseUid(firebaseUid) {
      const user = await client.user.findUnique({
        where: { firebaseUid },
        select: userSelect,
      });
      return user === null ? null : selectedUser(user);
    },
    async create(data) {
      return selectedUser(
        await client.user.create({ data, select: userSelect }),
      );
    },
    async updateById(id, data) {
      return selectedUser(
        await client.user.update({
          where: { id },
          data,
          select: userSelect,
        }),
      );
    },
  };
}

function isUniqueConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2002';
  }
  if (typeof error !== 'object' || error === null) return false;
  return (error as { code?: unknown }).code === 'P2002';
}

function metadata(identity: VerifiedFirebaseIdentity): FirebaseUserMetadata {
  return {
    email: identity.email,
    firebaseDisplayName: identity.displayName,
    firebasePhotoUrl: identity.photoUrl,
    firebaseProviderIds: [...new Set(identity.providerIds)],
  };
}

export async function synchronizeFirebaseUser(
  repository: FirebaseUserRepository,
  identity: VerifiedFirebaseIdentity,
): Promise<SyncedFirebaseUser> {
  if (identity.uid.trim() === '') {
    throw new AuthBoundaryError('INVALID_AUTH_TOKEN');
  }

  const existing = await repository.findByFirebaseUid(identity.uid);
  const userMetadata = metadata(identity);
  if (existing !== null) {
    return repository.updateById(existing.id, userMetadata);
  }

  try {
    return await repository.create({
      firebaseUid: identity.uid,
      ...userMetadata,
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;

    const racingUser = await repository.findByFirebaseUid(identity.uid);
    if (racingUser === null) {
      throw new AuthBoundaryError('AUTH_CONFIGURATION_ERROR', { cause: error });
    }
    return repository.updateById(racingUser.id, userMetadata);
  }
}
