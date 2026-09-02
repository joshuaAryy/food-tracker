const REMOTE_PUSH_FLAG = 'IOS_REMOTE_PUSH_ENABLED';
export interface RemotePushEnvironment {
  APP_ENV?: string;
  IOS_REMOTE_PUSH_ENABLED?: string;
}

export function parseRemotePushEnabled(value: string | undefined): boolean {
  if (value === undefined) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(
    `${REMOTE_PUSH_FLAG} must be exactly "true" or "false" when set.`,
  );
}

export function resolveRemotePushEnabled(
  environment: RemotePushEnvironment,
): boolean {
  const appEnvironment = environment.APP_ENV?.trim() || 'development';
  const enabled = parseRemotePushEnabled(environment[REMOTE_PUSH_FLAG]);
  if (appEnvironment === 'production' && !enabled) {
    throw new Error('Production builds require IOS_REMOTE_PUSH_ENABLED=true.');
  }
  return enabled;
}
