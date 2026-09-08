export interface NotificationAcceptanceGuardInput {
  environment: string;
  overrideEnabled: boolean;
  acceptanceFirebaseUid: string | undefined;
  configuredApprovedFirebaseUid: string | undefined;
  explicitTime: boolean;
  send: boolean;
  sendEnabled: boolean;
}

/**
 * Guard the fixed-clock/single-user staging harness. This is deliberately
 * separate from the worker so the production cron path has no acceptance
 * override surface.
 */
export function validateNotificationAcceptanceGuards(
  input: NotificationAcceptanceGuardInput,
): void {
  const requested =
    input.overrideEnabled ||
    input.explicitTime ||
    input.acceptanceFirebaseUid !== undefined ||
    (input.send && input.environment !== 'production');
  if (!requested) return;
  if (input.environment === 'production')
    throw new Error(
      'Notification acceptance overrides are unavailable in production.',
    );
  if (input.environment !== 'staging' && input.environment !== 'test')
    throw new Error(
      'Notification acceptance override requires APP_ENV=staging or test.',
    );
  if (!input.overrideEnabled)
    throw new Error(
      'Acceptance overrides require NOTIFICATION_ACCEPTANCE_TIME_OVERRIDE_ENABLED=true.',
    );
  if (input.acceptanceFirebaseUid === undefined)
    throw new Error(
      'A single acceptance Firebase UID is required when clock override is enabled.',
    );
  if (
    input.configuredApprovedFirebaseUid === undefined ||
    input.configuredApprovedFirebaseUid.trim() === ''
  )
    throw new Error(
      'NOTIFICATION_ACCEPTANCE_APPROVED_FIREBASE_UID must be configured.',
    );
  if (input.acceptanceFirebaseUid !== input.configuredApprovedFirebaseUid)
    throw new Error(
      'The acceptance Firebase UID is not approved for this environment.',
    );
  if (input.send && !input.sendEnabled)
    throw new Error(
      'Real acceptance sends require NOTIFICATION_ACCEPTANCE_SEND_ENABLED=true.',
    );
}
