import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { MOCK_USER_ID } from '@food-tracker/shared';
import { createApp } from '../src/app.js';

describe('health endpoint', () => {
  it('returns a minimal unauthenticated liveness response', async () => {
    const response = await request(
      createApp((_request, result, next) => {
        result.locals.userId = MOCK_USER_ID;
        next();
      }),
    ).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it('does not disclose implementation or environment details', async () => {
    const response = await request(createApp()).get('/health');
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toMatch(
      /DATABASE_URL|FIREBASE_|Prisma|stack|version|commit|environment|Railway/i,
    );
  });
});
