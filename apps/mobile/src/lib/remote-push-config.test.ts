import { describe, expect, it } from 'vitest';
import {
  parseRemotePushEnabled,
  resolveRemotePushEnabled,
} from './remote-push-config';

describe('remote push build capability', () => {
  it('defaults development and staging builds to disabled when unset', () => {
    expect(resolveRemotePushEnabled({ APP_ENV: 'development' })).toBe(false);
    expect(resolveRemotePushEnabled({ APP_ENV: 'staging' })).toBe(false);
  });

  it('accepts exact boolean values', () => {
    expect(parseRemotePushEnabled('false')).toBe(false);
    expect(parseRemotePushEnabled('true')).toBe(true);
  });

  it.each(['TRUE', 'False', ' true', 'false ', '1', 'yes', ''])(
    'rejects malformed values: %s',
    (value) => {
      expect(() => parseRemotePushEnabled(value)).toThrow(
        'IOS_REMOTE_PUSH_ENABLED must be exactly "true" or "false" when set.',
      );
    },
  );

  it('requires remote push for production builds', () => {
    expect(() =>
      resolveRemotePushEnabled({
        APP_ENV: 'production',
        IOS_REMOTE_PUSH_ENABLED: 'false',
      }),
    ).toThrow('Production builds require IOS_REMOTE_PUSH_ENABLED=true.');
    expect(
      resolveRemotePushEnabled({
        APP_ENV: 'production',
        IOS_REMOTE_PUSH_ENABLED: 'true',
      }),
    ).toBe(true);
  });
});
