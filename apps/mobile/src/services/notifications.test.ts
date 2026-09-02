import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isRemotePushEnabled: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  randomUUID: vi.fn(),
  registerInstallation: vi.fn(),
}));

vi.mock('@/lib/remote-push-capability', () => ({
  isRemotePushEnabled: mocks.isRemotePushEnabled,
}));
vi.mock('expo-device', () => ({
  isDevice: true,
  osName: 'iOS',
}));
vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: mocks.getPermissionsAsync,
  requestPermissionsAsync: mocks.requestPermissionsAsync,
  getExpoPushTokenAsync: mocks.getExpoPushTokenAsync,
  addPushTokenListener: vi.fn(),
}));
vi.mock('expo-crypto', () => ({ randomUUID: mocks.randomUUID }));
vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: null,
}));
vi.mock('@/lib/api-client', () => ({
  api: {
    notifications: {
      installations: { register: mocks.registerInstallation },
    },
  },
}));

import { registerPushInstallation } from './notifications';

describe('notification registration capability gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not touch native permission, token, or API registration when disabled', async () => {
    mocks.isRemotePushEnabled.mockReturnValue(false);

    await expect(registerPushInstallation()).resolves.toBe(false);

    expect(mocks.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mocks.registerInstallation).not.toHaveBeenCalled();
  });

  it('retains permission, token, and API registration for a push-enabled build', async () => {
    mocks.isRemotePushEnabled.mockReturnValue(true);
    mocks.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mocks.getExpoPushTokenAsync.mockResolvedValue({
      data: 'ExponentPushToken[uat-test-token]',
    });
    mocks.randomUUID.mockReturnValue('installation-1');
    mocks.registerInstallation.mockResolvedValue(undefined);
    const previousProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID = 'eas-project';

    try {
      await expect(registerPushInstallation()).resolves.toBe(true);
    } finally {
      if (previousProjectId === undefined) {
        delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
      } else {
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID = previousProjectId;
      }
    }

    expect(mocks.getPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'eas-project',
    });
    expect(mocks.registerInstallation).toHaveBeenCalledWith(
      'installation-1',
      'ExponentPushToken[uat-test-token]',
      'ios',
    );
  });
});
