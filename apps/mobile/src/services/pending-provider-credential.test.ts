import { describe, expect, it } from 'vitest';
import { PendingProviderCredentialStore } from './pending-provider-credential';

describe('pending provider credential store', () => {
  it('keeps one credential in memory for at most five minutes', () => {
    const store = new PendingProviderCredentialStore<string>();

    store.set('apple', 'private-credential', 1_000);
    expect(store.get(300_999)).toMatchObject({
      provider: 'apple',
      credential: 'private-credential',
    });
    expect(store.get(301_000)).toBeNull();
  });

  it.each(['success', 'failure', 'cancellation', 'signOut', 'background'])(
    'clears on %s',
    (reason) => {
      const store = new PendingProviderCredentialStore<string>();
      store.set('google', 'private-credential', 1_000);

      store.clear(reason as Parameters<typeof store.clear>[0]);

      expect(store.get(1_001)).toBeNull();
    },
  );

  it('replaces a previous active attempt without persistence', () => {
    const store = new PendingProviderCredentialStore<string>();
    store.set('apple', 'first', 1_000);
    store.set('google', 'second', 1_001);

    expect(store.get(1_002)).toMatchObject({
      provider: 'google',
      credential: 'second',
    });
  });
});
