import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import * as expoClient from '../src/modules/notifications/expo-client.js';
import { processDueNotificationReceipts } from '../src/modules/notifications/receipts.js';

describe('notification receipt worker deadline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not start receipt database work after the shared deadline', async () => {
    const findMany = vi.spyOn(prisma.notificationDeliveryAttempt, 'findMany');

    await expect(
      processDueNotificationReceipts(new Date('2026-09-01T12:00:00.000Z'), {
        deadlineAt: Date.now() - 1,
      }),
    ).resolves.toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('stops between receipt items while preserving already processed work', async () => {
    let currentNow = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => currentNow);
    const attempts = [
      {
        id: 'attempt-a',
        expoTicketId: 'ticket-a',
        installation: null,
      },
      {
        id: 'attempt-b',
        expoTicketId: 'ticket-b',
        installation: null,
      },
    ] as never;
    vi.spyOn(prisma.notificationDeliveryAttempt, 'findMany').mockResolvedValue(
      attempts,
    );
    const update = vi
      .spyOn(prisma.notificationDeliveryAttempt, 'update')
      .mockImplementation(() => {
        currentNow = 100;
        return {} as never;
      });
    vi.spyOn(expoClient, 'getExpoPushReceipts').mockResolvedValue({});

    await expect(
      processDueNotificationReceipts(new Date('2026-09-01T12:00:00.000Z'), {
        deadlineAt: 100,
      }),
    ).resolves.toBe(0);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
