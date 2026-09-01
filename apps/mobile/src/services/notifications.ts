import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const installationFile = () => {
  if (FileSystem.documentDirectory === null) return null;
  return `${FileSystem.documentDirectory}food-tracker-installation-id.txt`;
};

const pendingDetachFile = () => {
  if (FileSystem.documentDirectory === null) return null;
  return `${FileSystem.documentDirectory}food-tracker-push-detach-pending.txt`;
};

async function markDetachPending(): Promise<void> {
  const file = pendingDetachFile();
  if (file === null) return;
  try {
    await FileSystem.writeAsStringAsync(file, 'pending');
  } catch {
    // The network failure remains the authoritative error; local persistence
    // is best effort and must never block Firebase sign-out.
  }
}

async function clearDetachPending(): Promise<void> {
  const file = pendingDetachFile();
  if (file === null) return;
  try {
    const info = await FileSystem.getInfoAsync(file);
    if (info.exists) await FileSystem.deleteAsync(file, { idempotent: true });
  } catch {
    // A later authenticated bootstrap will retry the idempotent detach.
  }
}

let pushTokenSubscription: { remove: () => void } | null = null;

export async function getInstallationId(): Promise<string> {
  const file = installationFile();
  if (file !== null) {
    const info = await FileSystem.getInfoAsync(file);
    if (info.exists) {
      const value = await FileSystem.readAsStringAsync(file);
      if (value.trim() !== '') return value.trim();
    }
  }
  const value = Crypto.randomUUID();
  if (file !== null) await FileSystem.writeAsStringAsync(file, value);
  return value;
}

export async function registerPushInstallation(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const permissions = await Notifications.getPermissionsAsync();
  let status = permissions.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return false;
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof projectId !== 'string' || projectId.trim() === '') {
    throw new Error(
      'Expo project identity is unavailable for push registration.',
    );
  }
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: projectId.trim(),
  });
  const { api } = await import('@/lib/api-client');
  await api.notifications.installations.register(
    await getInstallationId(),
    token.data,
    Device.osName?.toLowerCase() === 'android' ? 'android' : 'ios',
  );
  if (pushTokenSubscription === null) {
    pushTokenSubscription = Notifications.addPushTokenListener(() => {
      void registerPushInstallation().catch(() => undefined);
    });
  }
  return true;
}

export async function detachPushInstallation(): Promise<void> {
  const { api } = await import('@/lib/api-client');
  try {
    await api.notifications.installations.detach(await getInstallationId());
    await clearDetachPending();
  } catch (error) {
    await markDetachPending();
    throw error;
  }
}

export function subscribeToNotificationResponses(
  onResponse: (response: Notifications.NotificationResponse) => void,
): () => void {
  const subscription =
    Notifications.addNotificationResponseReceivedListener(onResponse);
  return subscription.remove;
}

export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  const getter = Notifications.getLastNotificationResponseAsync;
  if (typeof getter !== 'function') return null;
  try {
    return await getter();
  } catch {
    // Native notification state is unavailable in Expo Go/Jest; cold-launch
    // routing remains best-effort and warm responses still use the listener.
    return null;
  }
}
