import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError } from '../src/lib/errors.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { validateBody } from '../src/middleware/validate.js';

function appWithError(error: unknown) {
  const app = express();
  app.get('/failure', (_request, _response, next) => next(error));
  app.use(errorHandler);
  return app;
}

function appWithValidation() {
  const app = express();
  app.use(express.json());
  app.post(
    '/validated',
    validateBody(z.object({ email: z.string().email() })),
    (_request, response) => response.json({ success: true }),
  );
  app.use(errorHandler);
  return app;
}

describe('public API error boundary', () => {
  it('does not serialize internal AppError message or details', async () => {
    const response = await request(
      appWithError(
        new AppError(
          500,
          'INTERNAL_SERVER_ERROR',
          'PrismaClientKnownRequestError: SELECT * FROM "User"',
          {
            databaseUrl:
              'DATABASE_URL=postgresql://user:password@host/database',
            providerBody: 'Authorization: Bearer test-secret-token',
            stack: '/Users/joshua/food_tracker/apps/api/src/server.ts',
          },
        ),
      ),
    ).get('/failure');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'The request could not be completed.',
        details: {},
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /Prisma|SELECT|DATABASE_URL|Authorization|Bearer|Users|server\.ts/,
    );
  });

  it('returns allowlisted validation fields without Zod internals or values', async () => {
    const response = await request(appWithValidation())
      .post('/validated')
      .send({ email: 'DATABASE_URL=postgresql://user:password@host/database' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: { fields: [{ field: 'email', reason: 'invalid' }] },
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /DATABASE_URL|postgresql|password|Zod|invalid_string|received|path/,
    );
  });

  it('returns a generic unknown-error envelope and sanitized diagnostics', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const response = await request(
      appWithError(
        new Error(
          'PrismaClientKnownRequestError DATABASE_URL=postgresql://user:password@host/database',
        ),
      ),
    ).get('/failure');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'The request could not be completed.',
        details: {},
      },
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(
      /Prisma|DATABASE_URL|postgresql|password|stack|server\.ts/,
    );
    warn.mockRestore();
  });

  it('uses an allowlisted contextual public message without trusting AppError.message', async () => {
    const response = await request(
      appWithError(
        new AppError(
          503,
          'AI_UNAVAILABLE',
          'PrismaClientKnownRequestError: SELECT * FROM "User"',
          { publicMessageKey: 'nutrition_estimate_cut_off' },
        ),
      ),
    ).get('/failure');

    expect(response.body.error.message).toBe(
      'AI nutrition estimates were cut off. Try again.',
    );
    expect(JSON.stringify(response.body)).not.toMatch(/Prisma|SELECT|User/);
  });
});
