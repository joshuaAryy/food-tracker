import { AuthServiceError } from '../services/auth-errors';

export function rawNonceFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

export async function generateAppleNonce(
  randomBytes: (length: number) => Promise<Uint8Array>,
  digest: (rawNonce: string) => Promise<string>,
): Promise<{ rawNonce: string; hashedNonce: string }> {
  const bytes = await randomBytes(32);
  if (bytes.byteLength !== 32) {
    throw new AuthServiceError('configurationError');
  }
  const rawNonce = rawNonceFromBytes(bytes);
  return { rawNonce, hashedNonce: await digest(rawNonce) };
}
