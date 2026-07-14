import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  photoProvisionalQuantitySchema,
  photoRepresentationKindSchema,
  type PhotoProvisionalQuantity,
  type PhotoRepresentationKind,
} from '@food-tracker/shared';
import { z } from 'zod';
import {
  validatePhotoNutritionEstimate,
  type PhotoNutritionEstimateValues,
} from './photo-nutrition-estimate.js';

const PROOF_VERSION = 1;
const MAX_TOKEN_LENGTH = 4096;
const CLOCK_SKEW_SECONDS = 30;

const proofPayloadSchema = z
  .strictObject({
    version: z.literal(PROOF_VERSION),
    userId: z.string().uuid(),
    rowRef: z.string().trim().min(1).max(80),
    recognizedName: z.string().trim().min(1).max(120),
    preparationForm: z.string().trim().min(1).max(80).nullable(),
    representationKind: photoRepresentationKindSchema,
    estimateBasis: z.enum(['structured_quantity', 'portion_shown']),
    quantity: photoProvisionalQuantitySchema,
    calories: z.number().int().positive(),
    proteinGrams: z.number().finite().nonnegative(),
    carbohydrateGrams: z.number().finite().nonnegative(),
    fatGrams: z.number().finite().nonnegative(),
    confidence: z.enum(['low', 'medium']),
    issuedAt: z.number().int().positive(),
    expiresAt: z.number().int().positive(),
    nonce: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  })
  .superRefine((payload, context) => {
    if (
      (payload.estimateBasis === 'structured_quantity') !==
      (payload.quantity.state === 'estimated')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'estimate basis does not match quantity state',
        path: ['estimateBasis'],
      });
    }
    if (payload.expiresAt <= payload.issuedAt) {
      context.addIssue({
        code: 'custom',
        message: 'proof expiry must be after issue time',
        path: ['expiresAt'],
      });
    }
  });

export type PhotoEstimateProofPayload = z.infer<typeof proofPayloadSchema>;

export type PhotoEstimateProofFailureReason =
  | 'malformed'
  | 'oversized'
  | 'unsupported_version'
  | 'invalid_signature'
  | 'invalid_payload'
  | 'expired'
  | 'future_issued'
  | 'user_mismatch'
  | 'row_mismatch';

export type PhotoEstimateProofVerification =
  | { ok: true; payload: PhotoEstimateProofPayload }
  | { ok: false; reason: PhotoEstimateProofFailureReason };

function encoded(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decoded(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return null;
  }
}

function signature(payloadSegment: string, secret: string): Buffer {
  return createHmac('sha256', secret)
    .update(`v${PROOF_VERSION}.${payloadSegment}`)
    .digest();
}

function assertSecret(secret: string | null): asserts secret is string {
  if (secret === null || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error(
      'PHOTO_ESTIMATE_PROOF_SECRET must contain at least 32 bytes when photo estimate confirmation is enabled.',
    );
  }
}

export function issuePhotoEstimateProof(input: {
  secret: string | null;
  userId: string;
  rowRef: string;
  recognizedName: string;
  preparationForm: string | null;
  representationKind: PhotoRepresentationKind;
  estimateBasis: 'structured_quantity' | 'portion_shown';
  quantity: PhotoProvisionalQuantity;
  estimate: PhotoNutritionEstimateValues;
  ttlSeconds: number;
  now?: Date;
}): string {
  assertSecret(input.secret);
  const issuedAt = Math.floor((input.now?.getTime() ?? Date.now()) / 1000);
  const payload: PhotoEstimateProofPayload = {
    version: PROOF_VERSION,
    userId: input.userId,
    rowRef: input.rowRef,
    recognizedName: input.recognizedName,
    preparationForm: input.preparationForm,
    representationKind: input.representationKind,
    estimateBasis: input.estimateBasis,
    quantity: input.quantity,
    calories: Math.round(input.estimate.calories),
    proteinGrams: input.estimate.proteinGrams,
    carbohydrateGrams: input.estimate.carbohydrateGrams,
    fatGrams: input.estimate.fatGrams,
    confidence: input.estimate.confidence,
    issuedAt,
    expiresAt: issuedAt + input.ttlSeconds,
    nonce: randomBytes(16).toString('base64url'),
  };
  const parsed = proofPayloadSchema.parse(payload);
  if (validatePhotoNutritionEstimate(parsed) === null) {
    throw new Error(
      'Cannot issue a proof for invalid photo estimate nutrition.',
    );
  }
  const payloadSegment = encoded(JSON.stringify(parsed));
  const signatureSegment = signature(payloadSegment, input.secret).toString(
    'base64url',
  );
  const token = `v${PROOF_VERSION}.${payloadSegment}.${signatureSegment}`;
  if (token.length > MAX_TOKEN_LENGTH) {
    throw new Error('Photo estimate proof exceeds the maximum token size.');
  }
  return token;
}

export function verifyPhotoEstimateProof(input: {
  token: string;
  secret: string | null;
  userId: string;
  rowRef: string;
  now?: Date;
}): PhotoEstimateProofVerification {
  if (input.secret === null || Buffer.byteLength(input.secret, 'utf8') < 32) {
    return { ok: false, reason: 'invalid_signature' };
  }
  if (input.token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, reason: 'oversized' };
  }
  const segments = input.token.split('.');
  if (segments.length !== 3 || segments[0] !== `v${PROOF_VERSION}`) {
    return {
      ok: false,
      reason: segments[0]?.startsWith('v')
        ? 'unsupported_version'
        : 'malformed',
    };
  }
  const payloadBuffer = decoded(segments[1] ?? '');
  const signatureBuffer = decoded(segments[2] ?? '');
  if (payloadBuffer === null || signatureBuffer === null) {
    return { ok: false, reason: 'malformed' };
  }
  const expected = signature(segments[1] ?? '', input.secret);
  if (
    expected.length !== signatureBuffer.length ||
    !timingSafeEqual(expected, signatureBuffer)
  ) {
    return { ok: false, reason: 'invalid_signature' };
  }

  let decodedPayload: unknown;
  try {
    decodedPayload = JSON.parse(payloadBuffer.toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const parsed = proofPayloadSchema.safeParse(decodedPayload);
  if (!parsed.success) return { ok: false, reason: 'invalid_payload' };

  const now = Math.floor((input.now?.getTime() ?? Date.now()) / 1000);
  if (parsed.data.issuedAt > now + CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: 'future_issued' };
  }
  if (parsed.data.expiresAt <= now) {
    return { ok: false, reason: 'expired' };
  }
  if (parsed.data.userId !== input.userId) {
    return { ok: false, reason: 'user_mismatch' };
  }
  if (parsed.data.rowRef !== input.rowRef) {
    return { ok: false, reason: 'row_mismatch' };
  }
  if (validatePhotoNutritionEstimate(parsed.data) === null) {
    return { ok: false, reason: 'invalid_payload' };
  }
  return { ok: true, payload: parsed.data };
}
