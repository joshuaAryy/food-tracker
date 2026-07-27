import { describe, expect, it } from 'vitest';
import { generateAppleNonce, rawNonceFromBytes } from './auth-nonce';

describe('Apple authentication nonce', () => {
  it('encodes cryptographically random bytes as a stable raw nonce', () => {
    expect(rawNonceFromBytes(new Uint8Array([0, 15, 16, 255]))).toBe(
      '000f10ff',
    );
  });

  it('returns the raw nonce and only its SHA-256 result for Apple', async () => {
    const bytes = new Uint8Array(32).fill(7);
    const rawNonce = rawNonceFromBytes(bytes);
    const result = await generateAppleNonce(
      async (length) => {
        expect(length).toBe(32);
        return bytes;
      },
      async (value) => {
        expect(value).toBe(rawNonce);
        return 'sha256-hash';
      },
    );

    expect(result).toEqual({ rawNonce, hashedNonce: 'sha256-hash' });
  });

  it('rejects a random source that returns the wrong length', async () => {
    await expect(
      generateAppleNonce(
        async () => new Uint8Array(31),
        async () => 'hash',
      ),
    ).rejects.toMatchObject({ code: 'configurationError' });
  });
});
