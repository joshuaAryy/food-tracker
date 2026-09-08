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

  it('does not let an authenticated user detach another user installation', async () => {
    const otherUserId = '00000000-0000-0000-0000-000000000002';
    await prisma.user.create({ data: { id: otherUserId } });
    await prisma.notificationInstallation.create({
      data: {
        installationId: 'install-other-user',
        userId: otherUserId,
        expoPushToken: 'ExponentPushToken[other-user-token]',
        tokenHash: 'other-user-token-hash',
        platform: 'ios',
        enabledAt: new Date(),
      },
    });

    await api
      .delete('/api/v1/notifications/installations/install-other-user')
      .expect(200);

    expect(
      await prisma.notificationInstallation.findUnique({
        where: { installationId: 'install-other-user' },
      }),
    ).toMatchObject({
      userId: otherUserId,
      expoPushToken: 'ExponentPushToken[other-user-token]',
      disabledAt: null,
    });
  });

  it('does not detach an installation already owned by the authenticated user during recovery', async () => {
    await api
      .put('/api/v1/notifications/installations/install-c')
      .send({
        expoPushToken: 'ExponentPushToken[account-c-token]',
        platform: 'ios',
        enabled: true,
      })
      .expect(200);

    await api
      .post('/api/v1/notifications/installations/install-c/reconcile')
      .expect(200);

    expect(
      await prisma.notificationInstallation.findUnique({
        where: { installationId: 'install-c' },
      }),
    ).toMatchObject({ userId: MOCK_USER_ID, disabledAt: null });
  });

  it('reconciles a stale prior-account installation without requiring its ownership', async () => {
    const priorUserId = '00000000-0000-0000-0000-000000000003';
    await prisma.user.create({ data: { id: priorUserId } });
    await prisma.notificationInstallation.create({
      data: {
        installationId: 'install-stale-prior-account',
        userId: priorUserId,
        expoPushToken: 'ExponentPushToken[stale-prior-token]',
        tokenHash: 'stale-prior-token-hash',
        platform: 'ios',
        enabledAt: new Date(),
      },
    });

    await api
      .post(
        '/api/v1/notifications/installations/install-stale-prior-account/reconcile',
      )
      .expect(200);

    expect(
      await prisma.notificationInstallation.findUnique({
        where: { installationId: 'install-stale-prior-account' },
      }),
    ).toMatchObject({
      userId: null,
      expoPushToken: null,
      tokenHash: null,
    });
  });
});
