import { describe, expect, it } from 'vitest';
import { api, expectErrorEnvelope } from './helpers/api.js';
import { seedPreferences, seedProfile } from './helpers/seeds.js';

const waterLogInput = {
  amountMl: 250,
  loggedAt: '2026-08-08T14:30:00.000Z',
};

describe('water logs API', () => {
  it('exposes the server-owned 2000 mL daily hydration goal without gating water visibility', async () => {
    await seedPreferences({ waterTrackingEnabled: false });

    const response = await api.get('/api/v1/tracking-preferences').expect(200);

    expect(response.body.data).toEqual({
      mode: 'simple',
      waterTrackingEnabled: false,
      dailyWaterGoalMl: 2000,
    });
  });

  it('creates, reads, updates, lists, and deletes a WaterLog', async () => {
    const created = await api
      .post('/api/v1/water-logs')
      .send(waterLogInput)
      .expect(200);

    expect(created.body.data).toMatchObject(waterLogInput);

    const byId = await api
      .get(`/api/v1/water-logs/${created.body.data.id as string}`)
      .expect(200);
    expect(byId.body.data).toMatchObject(waterLogInput);

    const updated = await api
      .put(`/api/v1/water-logs/${created.body.data.id as string}`)
      .send({ ...waterLogInput, amountMl: 500 })
      .expect(200);
    expect(updated.body.data.amountMl).toBe(500);

    const listed = await api
      .get('/api/v1/water-logs')
      .query({ date: '2026-08-08' })
      .expect(200);
    expect(listed.body.data.waterLogs).toHaveLength(1);
    expect(listed.body.data.waterLogs[0]).toMatchObject({ amountMl: 500 });

    await api
      .delete(`/api/v1/water-logs/${created.body.data.id as string}`)
      .expect(200);
    await api
      .get(`/api/v1/water-logs/${created.body.data.id as string}`)
      .expect(404);
  });

  it('validates supported amounts and filters by the profile timezone', async () => {
    await seedProfile({ timezone: 'America/Toronto' });
    await api.post('/api/v1/water-logs').send(waterLogInput).expect(200);

    const dateRange = await api
      .get('/api/v1/water-logs')
      .query({ startDate: '2026-08-08', endDate: '2026-08-08' })
      .expect(200);
    expect(dateRange.body.data.waterLogs).toHaveLength(1);

    const invalid = await api
      .post('/api/v1/water-logs')
      .send({ ...waterLogInput, amountMl: 5001 })
      .expect(400);
    expectErrorEnvelope(invalid.body, 'VALIDATION_ERROR');
  });
});
