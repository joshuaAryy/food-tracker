import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendExpoPushNotifications } from '../src/modules/notifications/expo-client.js';
import { notificationRouteForKind } from '../src/modules/notifications/worker.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Expo client deadlines', () => {
  it('keeps notification destinations aligned with their purpose', () => {
    expect(notificationRouteForKind('logging_reminder')).toBe('/food-log');
    expect(notificationRouteForKind('recommendation')).toBe('/insights');
  });

  it('aborts a hanging request at the supplied timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new Error('aborted')),
            );
          }),
      ),
    );

    await expect(
      sendExpoPushNotifications(
        [
          {
            to: 'ExponentPushToken[test]',
            title: 'Food Tracker',
            body: 'A new nutrition insight is ready.',
            data: { route: '/insights' },
          },
        ],
        5,
      ),
    ).rejects.toThrow('aborted');
  });
});
