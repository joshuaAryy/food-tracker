import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';

describe('standardized API errors', () => {
  it('returns a JSON NOT_FOUND envelope for unknown routes', async () => {
    const response = await api.get('/api/v1/does-not-exist').expect(404);

    expect(response.headers['content-type']).toMatch(/json/);
    expectErrorEnvelope(response.body, 'NOT_FOUND');
  });

  it('returns a JSON VALIDATION_ERROR envelope', async () => {
    const response = await api
      .post('/api/v1/weight-logs')
      .send({ weightLb: -1, loggedAt: 'invalid' })
      .expect(400);

    expect(response.headers['content-type']).toMatch(/json/);
    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('returns JSON rather than Express HTML for a database failure', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.spyOn(prisma.userProfile, 'findUnique').mockRejectedValueOnce(
      new Error('Database unavailable'),
    );

    const response = await api.get('/api/v1/profile').expect(500);

    expect(response.headers['content-type']).toMatch(/json/);
    expectErrorEnvelope(response.body, 'INTERNAL_SERVER_ERROR');
    expect(response.text).not.toContain('<html');
    consoleError.mockRestore();
  });

  it.skip('returns NOT_FOUND when dismissing a recommendation not owned by the user', async () => {
    const response = await api
      .patch(
        '/api/v1/recommendations/00000000-0000-4000-8000-000000000099/dismiss',
      )
      .expect(404);

    expectErrorEnvelope(response.body, 'NOT_FOUND');
  });
});
