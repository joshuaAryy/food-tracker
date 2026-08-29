import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

const installationFile = () => {
  if (FileSystem.documentDirectory === null) return null;
  return `${FileSystem.documentDirectory}food-tracker-installation-id.txt`;
};

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
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const token = await Notifications.getExpoPushTokenAsync(
    projectId === undefined ? {} : { projectId },
  );
  const { api } = await import('@/lib/api-client');
  await api.notifications.installations.register(
    await getInstallationId(),
    token.data,
    Device.osName?.toLowerCase() === 'android' ? 'android' : 'ios',
  );
  return true;
}

export async function detachPushInstallation(): Promise<void> {
  const { api } = await import('@/lib/api-client');
  await api.notifications.installations.detach(await getInstallationId());
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
