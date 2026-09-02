import Constants from 'expo-constants';

export function remotePushEnabledFromExtra(extra: unknown): boolean {
  return (
    typeof extra === 'object' &&
    extra !== null &&
    (extra as { remotePushEnabled?: unknown }).remotePushEnabled === true
  );
}

export function isRemotePushEnabled(): boolean {
  return remotePushEnabledFromExtra(Constants.expoConfig?.extra);
}
