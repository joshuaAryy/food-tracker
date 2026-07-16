import { describe, expect, it } from 'vitest';
import {
  issuePhotoEstimateProof,
  verifyPhotoEstimateProof,
} from '../src/modules/ai/photo-estimate-proof.js';

const secret = 'c1-test-secret-with-at-least-32-bytes-long';
const baseInput = {
  secret,
  userId: '00000000-0000-4000-8000-000000000001',
  rowRef: 'photo-item-1',
  recognizedName: 'Pasta with tomato sauce',
  preparationForm: 'cooked',
  representationKind: 'composite' as const,
  estimateBasis: 'structured_quantity' as const,
  quantity: {
    state: 'estimated' as const,
    amount: 1.5,
    unit: 'cup' as const,
    countLabel: null,
    rawText: 'approximately 1.5 cups',
    confidence: 'medium' as const,
  },
  estimate: {
    calories: 460,
    proteinGrams: 15.3,
    carbohydrateGrams: 76.1,
    fatGrams: 11,
    confidence: 'low' as const,
  },
  ttlSeconds: 900,
  now: new Date('2026-07-14T12:00:00.000Z'),
};

describe('photo estimate proofs', () => {
  it('issues and verifies a signed, row-bound proof', () => {
    const token = issuePhotoEstimateProof(baseInput);
    const verified = verifyPhotoEstimateProof({
      token,
      secret,
      userId: baseInput.userId,
      rowRef: baseInput.rowRef,
      now: baseInput.now,
    });

    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.payload.userId).toBe(baseInput.userId);
      expect(verified.payload.rowRef).toBe(baseInput.rowRef);
      expect(verified.payload.estimateBasis).toBe('structured_quantity');
      expect(verified.payload.calories).toBe(460);
    }
    expect(token.startsWith('v1.')).toBe(true);
  });

  it.each([
    ['tampered payload', (token: string) => `${token}x`, 'invalid_signature'],
    ['malformed token', () => 'not-a-proof', 'malformed'],
    [
      'unsupported version',
      (token: string) => token.replace(/^v1/, 'v2'),
      'unsupported_version',
    ],
  ])('%s fails safely', (_label, mutate, reason) => {
    const token = issuePhotoEstimateProof(baseInput);
    const result = verifyPhotoEstimateProof({
      token: mutate(token),
      secret,
      userId: baseInput.userId,
      rowRef: baseInput.rowRef,
      now: baseInput.now,
    });
    expect(result).toEqual({ ok: false, reason });
  });

  it('rejects expiry, future issue time, wrong user, and wrong row', () => {
    const token = issuePhotoEstimateProof(baseInput);
    expect(
      verifyPhotoEstimateProof({
        token,
        secret,
        userId: baseInput.userId,
        rowRef: baseInput.rowRef,
        now: new Date('2026-07-14T12:16:00.000Z'),
      }),
    ).toEqual({ ok: false, reason: 'expired' });
    expect(
      verifyPhotoEstimateProof({
        token,
        secret,
        userId: '00000000-0000-4000-8000-000000000002',
        rowRef: baseInput.rowRef,
        now: baseInput.now,
      }),
    ).toEqual({ ok: false, reason: 'user_mismatch' });
    expect(
      verifyPhotoEstimateProof({
        token,
        secret,
        userId: baseInput.userId,
        rowRef: 'photo-item-2',
        now: baseInput.now,
      }),
    ).toEqual({ ok: false, reason: 'row_mismatch' });
  });

  it('rejects weak secrets and invalid quantity/basis combinations', () => {
    expect(() =>
      issuePhotoEstimateProof({ ...baseInput, secret: 'short' }),
    ).toThrow('PHOTO_ESTIMATE_PROOF_SECRET');
    expect(() =>
      issuePhotoEstimateProof({
        ...baseInput,
        estimateBasis: 'portion_shown',
      }),
    ).toThrow();
  });
});
