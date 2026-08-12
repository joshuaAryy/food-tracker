import { MOCK_USER_ID } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';
import { seedPreferences } from './helpers/seeds.js';

const savedViewInput = {
  name: 'Protein + Weight · 90D',
  primaryMetric: 'protein',
  comparisonMetric: 'weight',
  periodDays: 90,
  aggregation: 'automatic',
  visualization: 'dual_axis',
  showReference: true,
  coverageFilter: 'all_logged_days',
};

describe('analytics saved views API', () => {
  it('saves, updates, duplicates, reorders, pins, unpins, and deletes a relative view', async () => {
    await seedPreferences({ mode: 'complex' });
    const created = await api
      .post('/api/v1/analytics/saved-views')
      .send(savedViewInput)
      .expect(201);
    const savedViewId = created.body.data.savedView.id as string;
    expect(created.body.data.savedView).toMatchObject({
      ...savedViewInput,
      id: expect.any(String),
      sortOrder: 0,
      unavailableMetrics: [],
    });

    const updated = await api
      .patch(`/api/v1/analytics/saved-views/${savedViewId}`)
      .send({ name: 'Protein and Weight · 90D' })
      .expect(200);
    expect(updated.body.data.savedView.name).toBe('Protein and Weight · 90D');

    const duplicated = await api
      .post(`/api/v1/analytics/saved-views/${savedViewId}/duplicate`)
      .send({})
      .expect(201);
    const duplicateId = duplicated.body.data.savedView.id as string;
    expect(duplicated.body.data.savedView).toMatchObject({
      id: expect.any(String),
      name: 'Protein and Weight · 90D copy',
      sortOrder: 1,
    });

    const reordered = await api
      .put('/api/v1/analytics/saved-views/order')
      .send({ ids: [duplicateId, savedViewId] })
      .expect(200);
    expect(
      reordered.body.data.savedViews.map((view: { id: string }) => view.id),
    ).toEqual([duplicateId, savedViewId]);

    const pinned = await api
      .put('/api/v1/analytics/preferences')
      .send({ pinnedSavedViewId: duplicateId })
      .expect(200);
    expect(pinned.body.data.preferences).toMatchObject({
      pinnedSavedViewId: duplicateId,
      preferredSimpleMetric: 'calories',
    });

    const unpinned = await api
      .put('/api/v1/analytics/preferences')
      .send({ pinnedSavedViewId: null })
      .expect(200);
    expect(unpinned.body.data.preferences.pinnedSavedViewId).toBeNull();

    await api
      .put('/api/v1/analytics/preferences')
      .send({ pinnedSavedViewId: duplicateId })
      .expect(200);
    await api
      .delete(`/api/v1/analytics/saved-views/${duplicateId}`)
      .expect(200);
    const preferencesAfterDelete = await api
      .get('/api/v1/analytics/preferences')
      .expect(200);
    expect(
      preferencesAfterDelete.body.data.preferences.pinnedSavedViewId,
    ).toBeNull();
    const listed = await api.get('/api/v1/analytics/saved-views').expect(200);
    expect(listed.body.data.savedViews).toHaveLength(1);
    expect(listed.body.data.savedViews[0]).toMatchObject({
      id: savedViewId,
      sortOrder: 0,
    });
  });

  it('preserves unavailable stored metrics and rejects cross-user mutations', async () => {
    await seedPreferences({ mode: 'complex' });
    const otherUserId = '00000000-0000-4000-8000-000000000002';
    await prisma.user.create({ data: { id: otherUserId } });
    const unavailable = await prisma.analyticsSavedView.create({
      data: {
        userId: MOCK_USER_ID,
        name: 'Historical unavailable nutrient',
        primaryMetric: 'retiredNutrient',
        comparisonMetric: null,
        periodDays: 30,
        aggregation: 'automatic',
        visualization: 'automatic',
        showReference: true,
        coverageFilter: 'all_logged_days',
        sortOrder: 0,
      },
    });
    const otherView = await prisma.analyticsSavedView.create({
      data: {
        userId: otherUserId,
        name: 'Other user view',
        primaryMetric: 'calories',
        comparisonMetric: null,
        periodDays: 7,
        aggregation: 'automatic',
        visualization: 'automatic',
        showReference: true,
        coverageFilter: 'all_logged_days',
        sortOrder: 0,
      },
    });

    const listed = await api.get('/api/v1/analytics/saved-views').expect(200);
    expect(listed.body.data.savedViews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: unavailable.id,
          unavailableMetrics: ['retiredNutrient'],
        }),
      ]),
    );

    const response = await api
      .put('/api/v1/analytics/preferences')
      .send({ pinnedSavedViewId: otherView.id })
      .expect(404);
    expectErrorEnvelope(response.body, 'NOT_FOUND');

    const updateResponse = await api
      .patch(`/api/v1/analytics/saved-views/${otherView.id}`)
      .send({ name: 'Attempted cross-user update' })
      .expect(404);
    expectErrorEnvelope(updateResponse.body, 'NOT_FOUND');

    const deleteResponse = await api
      .delete(`/api/v1/analytics/saved-views/${otherView.id}`)
      .expect(404);
    expectErrorEnvelope(deleteResponse.body, 'NOT_FOUND');
  });

  it('rejects Complex saved-view controls for Simple mode', async () => {
    await seedPreferences({ mode: 'simple' });

    const response = await api
      .post('/api/v1/analytics/saved-views')
      .send(savedViewInput)
      .expect(400);
    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('rejects incoherent comparison and visualization configurations on create and merged update', async () => {
    await seedPreferences({ mode: 'complex' });
    const invalidCreate = await api
      .post('/api/v1/analytics/saved-views')
      .send({
        ...savedViewInput,
        comparisonMetric: 'macroComposition',
        visualization: 'dual_axis',
      })
      .expect(400);
    expectErrorEnvelope(invalidCreate.body, 'VALIDATION_ERROR');

    const created = await api
      .post('/api/v1/analytics/saved-views')
      .send(savedViewInput)
      .expect(201);
    const invalidUpdate = await api
      .patch(
        `/api/v1/analytics/saved-views/${created.body.data.savedView.id as string}`,
      )
      .send({ comparisonMetric: 'carbs' })
      .expect(400);
    expectErrorEnvelope(invalidUpdate.body, 'VALIDATION_ERROR');
  });

  it('accepts Weight and Hydration saved views without food-logging coverage filters', async () => {
    await seedPreferences({ mode: 'complex' });

    for (const [primaryMetric, name] of [
      ['weight', 'Weight · 30D'],
      ['hydration', 'Hydration · 30D'],
    ] as const) {
      const response = await api
        .post('/api/v1/analytics/saved-views')
        .send({
          ...savedViewInput,
          name,
          primaryMetric,
          comparisonMetric: null,
          visualization: 'automatic',
          coverageFilter: 'all_logged_days',
        })
        .expect(201);

      expect(response.body.data.savedView).toMatchObject({
        name,
        primaryMetric,
        comparisonMetric: null,
        coverageFilter: 'all_logged_days',
        unavailableMetrics: [],
      });
    }
  });

  it('rejects a visualization the selected metric cannot render', async () => {
    await seedPreferences({ mode: 'complex' });

    const response = await api
      .post('/api/v1/analytics/saved-views')
      .send({
        ...savedViewInput,
        comparisonMetric: undefined,
        primaryMetric: 'calories',
        visualization: 'macro_donut',
      })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });
});
