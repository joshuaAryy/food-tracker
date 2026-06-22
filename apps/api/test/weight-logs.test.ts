import { MOCK_USER_ID } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';
import { localDateTime } from './helpers/dates.js';
import { seedProfile } from './helpers/seeds.js';

const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';
const MISSING_WEIGHT_LOG_ID = '00000000-0000-4000-8000-000000000099';

const validWeightLog = {
  weightLb: 181.24,
  loggedAt: '2026-06-15T13:00:00.000Z',
};

describe('weight logs API', () => {
  it('creates and reads a persisted weight log', async () => {
    const created = await api
      .post('/api/v1/weight-logs')
      .send(validWeightLog)
      .expect(200);
    const listed = await api.get('/api/v1/weight-logs').expect(200);
    const persisted = await prisma.weightLog.findUnique({
      where: { id: created.body.data.id as string },
    });

    expect(created.body.data.weightLb).toBe(181.2);
    expect(listed.body.data.weightLogs).toHaveLength(1);
    expect(persisted?.userId).toBe(MOCK_USER_ID);
  });

  it('returns a current-user weight log by id', async () => {
    const created = await api
      .post('/api/v1/weight-logs')
      .send(validWeightLog)
      .expect(200);

    const response = await api
      .get(`/api/v1/weight-logs/${created.body.data.id as string}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: created.body.data.id,
        weightLb: 181.2,
      },
    });
  });

  it('returns not found for a missing weight log', async () => {
    const response = await api
      .get(`/api/v1/weight-logs/${MISSING_WEIGHT_LOG_ID}`)
      .expect(404);

    expectErrorEnvelope(response.body, 'NOT_FOUND');
  });

  it('does not return another user’s weight log by id', async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const weightLog = await prisma.weightLog.create({
      data: {
        userId: OTHER_USER_ID,
        weightLb: 176.5,
        loggedAt: new Date(validWeightLog.loggedAt),
      },
    });

    const response = await api
      .get(`/api/v1/weight-logs/${weightLog.id}`)
      .expect(404);

    expectErrorEnvelope(response.body, 'NOT_FOUND');
  });

  it('updates a weight log', async () => {
    const created = await api
      .post('/api/v1/weight-logs')
      .send(validWeightLog)
      .expect(200);

    const response = await api
      .put(`/api/v1/weight-logs/${created.body.data.id as string}`)
      .send({ ...validWeightLog, weightLb: 179.8 })
      .expect(200);

    expect(response.body.data.weightLb).toBe(179.8);
    expect(
      (
        await prisma.weightLog.findUnique({
          where: { id: created.body.data.id as string },
        })
      )?.weightLb.toNumber(),
    ).toBe(179.8);
  });

  it('deletes a weight log', async () => {
    const created = await api
      .post('/api/v1/weight-logs')
      .send(validWeightLog)
      .expect(200);

    await api
      .delete(`/api/v1/weight-logs/${created.body.data.id as string}`)
      .expect(200);

    expect(
      await prisma.weightLog.findUnique({
        where: { id: created.body.data.id as string },
      }),
    ).toBeNull();
  });

  it.each([
    ['invalid weight', { ...validWeightLog, weightLb: 0 }],
    ['invalid datetime', { ...validWeightLog, loggedAt: 'invalid' }],
  ])('rejects %s', async (_label, input) => {
    const response = await api
      .post('/api/v1/weight-logs')
      .send(input)
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('filters weight logs by local date range', async () => {
    await seedProfile();
    await prisma.weightLog.createMany({
      data: [
        {
          userId: MOCK_USER_ID,
          weightLb: 180,
          loggedAt: new Date(localDateTime('2026-06-14')),
        },
        {
          userId: MOCK_USER_ID,
          weightLb: 179,
          loggedAt: new Date(localDateTime('2026-06-15')),
        },
      ],
    });

    const response = await api
      .get('/api/v1/weight-logs')
      .query({ startDate: '2026-06-15', endDate: '2026-06-15' })
      .expect(200);

    expect(response.body.data.weightLogs).toHaveLength(1);
    expect(response.body.data.weightLogs[0].weightLb).toBe(179);
  });
});
