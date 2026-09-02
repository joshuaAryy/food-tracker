import { describe, expect, it } from 'vitest';
import { remotePushEnabledFromExtra } from './remote-push-capability';

describe('runtime remote push capability', () => {
  it('uses the resolved Expo extra capability rather than EAS identity', () => {
    expect(remotePushEnabledFromExtra({ remotePushEnabled: false })).toBe(
      false,
    );
    expect(
      remotePushEnabledFromExtra({
        remotePushEnabled: true,
        eas: undefined,
      }),
    ).toBe(true);
    expect(
      remotePushEnabledFromExtra({ eas: { projectId: 'only-eas-id' } }),
    ).toBe(false);
  });
});
