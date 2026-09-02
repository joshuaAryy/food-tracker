import { describe, expect, it } from 'vitest';
import { validateNotificationAcceptanceGuards } from '../src/modules/notifications/acceptance-guards.js';

const base = {
  environment: 'staging',
  overrideEnabled: true,
  acceptanceFirebaseUid: 'approved',
  configuredApprovedFirebaseUid: 'approved',
  explicitTime: true,
  send: false,
  sendEnabled: false,
};

describe('notification acceptance guards', () => {
  it('allows an explicitly approved staging dry run', () => {
    expect(() => validateNotificationAcceptanceGuards(base)).not.toThrow();
  });

  it.each([
    ['wrong UID', { acceptanceFirebaseUid: 'other' }],
    ['missing UID', { acceptanceFirebaseUid: undefined }],
    [
      'missing approved configuration',
      { configuredApprovedFirebaseUid: undefined },
    ],
  ])('rejects %s', (_label, override) => {
    expect(() =>
      validateNotificationAcceptanceGuards({ ...base, ...override }),
    ).toThrow();
  });

  it('rejects every acceptance override in production', () => {
    expect(() =>
      validateNotificationAcceptanceGuards({
        ...base,
        environment: 'production',
      }),
    ).toThrow(/production/);
  });

  it('requires an independent send authorization', () => {
    expect(() =>
      validateNotificationAcceptanceGuards({ ...base, send: true }),
    ).toThrow(/SEND_ENABLED/);
    expect(() =>
      validateNotificationAcceptanceGuards({
        ...base,
        send: true,
        sendEnabled: true,
      }),
    ).not.toThrow();
  });

  it('does not allow a staging send without the scoped acceptance identity', () => {
    expect(() =>
      validateNotificationAcceptanceGuards({
        ...base,
        overrideEnabled: false,
        explicitTime: false,
        acceptanceFirebaseUid: undefined,
        send: true,
        sendEnabled: true,
      }),
    ).toThrow(/NOTIFICATION_ACCEPTANCE_TIME_OVERRIDE_ENABLED/);
  });

  it('keeps the ordinary production cron path free of acceptance overrides', () => {
    expect(() =>
      validateNotificationAcceptanceGuards({
        ...base,
        environment: 'production',
        overrideEnabled: false,
        acceptanceFirebaseUid: undefined,
        configuredApprovedFirebaseUid: undefined,
        explicitTime: false,
        send: true,
      }),
    ).not.toThrow();
  });
});
