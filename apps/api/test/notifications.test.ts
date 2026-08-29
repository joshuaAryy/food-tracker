import { MOCK_USER_ID } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectSuccessEnvelope } from './helpers/api.js';

describe('notification registration and preferences', () => {
  it('is idempotent and keeps installation ownership user-scoped', async () => {
    const body = {
      expoPushToken: 'ExponentPushToken[account-a-token]',
      platform: 'ios',
      enabled: true,
    } as const;

    const first = await api
      .put('/api/v1/notifications/installations/install-a')
      .send(body)
      .expect(200);
    const second = await api
      .put('/api/v1/notifications/installations/install-a')
      .send(body)
      .expect(200);

    expectSuccessEnvelope(first.body);
    expect(second.body.data).toEqual(first.body.data);
    expect(
      await prisma.notificationInstallation.count({
        where: { userId: MOCK_USER_ID, installationId: 'install-a' },
      }),
    ).toBe(1);
  });

  it('detaches an installation and persists explicit preference choices', async () => {
    await api
      .put('/api/v1/notifications/installations/install-b')
      .send({
        expoPushToken: 'ExponentPushToken[account-b-token]',
        platform: 'ios',
        enabled: true,
      })
      .expect(200);

    const preference = await api
      .put('/api/v1/notifications/preferences')
      .send({
        recommendationInsightsEnabled: true,
        loggingRemindersEnabled: false,
      })
      .expect(200);
    expect(preference.body.data).toEqual({
      recommendationInsightsEnabled: true,
      loggingRemindersEnabled: false,
    });

    await api
      .delete('/api/v1/notifications/installations/install-b')
      .expect(200);
    expect(
      await prisma.notificationInstallation.findUnique({
        where: { installationId: 'install-b' },
      }),
    ).toMatchObject({
      userId: null,
      expoPushToken: null,
      tokenHash: null,
    });
  });
});
