import type { PrismaClient } from '@prisma/client';
import type {
  AccountDeletionRecord,
  AccountDeletionRepository,
} from './account-deletion.js';

export function createPrismaAccountDeletionRepository(
  client: PrismaClient,
): AccountDeletionRepository {
  return {
    async prepare(firebaseUid): Promise<AccountDeletionRecord> {
      return client.$transaction(async (transaction) => {
        const existing = await transaction.accountDeletion.findUnique({
          where: { firebaseUid },
        });
        if (existing !== null) {
          if (existing.applicationUserId !== null) {
            await transaction.user.deleteMany({
              where: { id: existing.applicationUserId },
            });
          }
          return {
            firebaseUid: existing.firebaseUid,
            applicationUserId: existing.applicationUserId,
          };
        }

        const user = await transaction.user.findUnique({
          where: { firebaseUid },
          select: { id: true },
        });
        const pending = await transaction.accountDeletion.create({
          data: {
            firebaseUid,
            applicationUserId: user?.id ?? null,
          },
        });
        if (user !== null) {
          await transaction.user.delete({ where: { id: user.id } });
        }
        return {
          firebaseUid: pending.firebaseUid,
          applicationUserId: pending.applicationUserId,
        };
      });
    },
    async complete(firebaseUid) {
      await client.accountDeletion.deleteMany({ where: { firebaseUid } });
    },
  };
}
