import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import type { VerifiedFirebaseIdentity } from '../../auth/types.js';
import {
  AccountDeletionProviderError,
  permanentlyDeleteAccount,
} from '../../auth/account-deletion.js';
import { createPrismaAccountDeletionRepository } from '../../auth/account-deletion-repository.js';
import { createConfiguredFirebaseAdminAuthAdapter } from '../../auth/firebase-admin.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';

export interface AccountDeletionRouteDependencies {
  deleteFirebaseUser(firebaseUid: string): Promise<void>;
  repository: ReturnType<typeof createPrismaAccountDeletionRepository>;
}

function runtimeDependencies(): AccountDeletionRouteDependencies {
  const adapter = createConfiguredFirebaseAdminAuthAdapter();
  return {
    deleteFirebaseUser: (firebaseUid) => adapter.deleteUser(firebaseUid),
    repository: createPrismaAccountDeletionRepository(prisma),
  };
}

function identityFrom(response: Response): VerifiedFirebaseIdentity {
  const identity = response.locals.firebaseIdentity as
    | VerifiedFirebaseIdentity
    | undefined;
  if (identity === undefined) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
  }
  return identity;
}

export function createAccountRouter(
  dependenciesFactory: () => AccountDeletionRouteDependencies = runtimeDependencies,
): Router {
  const router = Router();

  router.delete(
    '/',
    async (_request: Request, response: Response, next: NextFunction) => {
      try {
        const identity = identityFrom(response);
        const dependencies = dependenciesFactory();
        await permanentlyDeleteAccount({
          firebaseUid: identity.uid,
          repository: dependencies.repository,
          deleteFirebaseUser: dependencies.deleteFirebaseUser,
        });
        sendSuccess(response, { deleted: true });
      } catch (error) {
        if (error instanceof AppError) {
          next(error);
          return;
        }
        if (error instanceof AccountDeletionProviderError) {
          next(
            new AppError(
              503,
              'INTERNAL_SERVER_ERROR',
              'The request could not be completed.',
            ),
          );
          return;
        }
        next(
          new AppError(
            503,
            'INTERNAL_SERVER_ERROR',
            'The request could not be completed.',
          ),
        );
      }
    },
  );

  return router;
}
