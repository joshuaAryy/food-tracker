import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createAccountRouter } from '../src/modules/account/routes.js';
import { AccountDeletionProviderError } from '../src/auth/account-deletion.js';
import type { VerifiedFirebaseIdentity } from '../src/auth/types.js';
import { errorHandler } from '../src/middleware/error-handler.js';

const identity: VerifiedFirebaseIdentity = {
  uid: 'firebase-user-1',
  email: null,
  emailVerified: true,
  displayName: null,
  photoUrl: null,
  providerIds: ['google.com'],
  signInProvider: 'google.com',
  issuedAt: 100,
  authenticatedAt: 100,
};

function appWith(
  deleteFirebaseUser = vi.fn().mockResolvedValue(undefined),
  repository = {
    prepare: vi.fn().mockResolvedValue({
      firebaseUid: identity.uid,
      applicationUserId: 'application-user-1',
    }),
    complete: vi.fn().mockResolvedValue(undefined),
  },
) {
  const app = express();
  app.use(express.json());
  app.use((_request, response, next) => {
    response.locals.firebaseIdentity = identity;
    next();
  });
  app.use(
    '/api/v1/account',
    createAccountRouter(() => ({ deleteFirebaseUser, repository })),
  );
  app.use(errorHandler);
  return { app, deleteFirebaseUser, repository };
}

describe('account deletion route', () => {
  it('uses only the verified identity and returns the success envelope', async () => {
    const { app, deleteFirebaseUser, repository } = appWith();

    await request(app)
      .delete('/api/v1/account')
      .send({ firebaseUid: 'another-user', userId: 'another-application-user' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true, data: { deleted: true } });
      });

    expect(repository.prepare).toHaveBeenCalledWith(identity.uid);
    expect(deleteFirebaseUser).toHaveBeenCalledWith(identity.uid);
  });

  it('returns a safe availability response when provider deletion fails', async () => {
    const { app } = appWith(
      vi.fn().mockRejectedValue(new AccountDeletionProviderError()),
    );

    await request(app)
      .delete('/api/v1/account')
      .expect(500)
      .expect(({ body }) => {
        expect(body.error).toEqual(
          expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'The request could not be completed.',
          }),
        );
        expect(JSON.stringify(body)).not.toContain('Firebase');
      });
  });
});
