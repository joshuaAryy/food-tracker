import {
  Prisma,
  type Recommendation as PrismaRecommendation,
} from '@prisma/client';
import { addLocalDays, localDate } from '../../lib/dates.js';
import { prisma } from '../../lib/prisma.js';
import { computeRecommendationFacts } from '../analytics/recommendation-facts.js';
import {
  generateRecommendationCandidates,
  MANAGED_RECOMMENDATION_TYPES,
} from './engine.js';
import { createHash } from 'node:crypto';

export function recommendationConditionFingerprint(
  candidate: Pick<
    import('./engine.js').RecommendationCandidate,
    | 'identityKey'
    | 'severity'
    | 'goalRelevanceScore'
    | 'effectiveTargetSource'
    | 'referenceVersion'
    | 'goalType'
  > &
    Partial<Pick<import('./engine.js').RecommendationCandidate, 'sourceFacts'>>,
): string {
  const stableCondition = {
    identityKey: candidate.identityKey,
    severity: candidate.severity,
    conditionBand: candidate.severity,
    goalRelevanceBand: candidate.goalRelevanceScore,
    effectiveTargetSource: candidate.effectiveTargetSource ?? null,
    referenceVersion: candidate.referenceVersion ?? null,
    goalType: candidate.goalType ?? null,
  };
  return createHash('sha256')
    .update(JSON.stringify(stableCondition))
    .digest('hex');
}

function confidenceScore(sourceFacts: Record<string, string | number | null>) {
  const coverage =
    typeof sourceFacts.coverage === 'number' ? sourceFacts.coverage : null;
  if (coverage !== null) return Math.round(coverage * 100);
  const loggedDays =
    typeof sourceFacts.loggedDays === 'number' ? sourceFacts.loggedDays : null;
  return loggedDays === null ? 0 : Math.round((loggedDays / 7) * 100);
}

function persistedSourceFacts(
  candidate: import('./engine.js').RecommendationCandidate,
) {
  return {
    ...candidate.sourceFacts,
    goalRelevanceScore: candidate.goalRelevanceScore,
    rulePriority: candidate.rulePriority,
    confidenceScore: confidenceScore(candidate.sourceFacts),
  };
}

function numericFact(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function comparePersistedRecommendations(
  left: Pick<
    PrismaRecommendation,
    'severity' | 'identityKey' | 'type' | 'sourceFacts'
  >,
  right: Pick<
    PrismaRecommendation,
    'severity' | 'identityKey' | 'type' | 'sourceFacts'
  >,
): number {
  const severityRank = { high: 3, medium: 2, low: 1 } as const;
  const leftFacts = (left.sourceFacts ?? {}) as Record<string, unknown>;
  const rightFacts = (right.sourceFacts ?? {}) as Record<string, unknown>;
  const severity = severityRank[right.severity] - severityRank[left.severity];
  if (severity !== 0) return severity;
  const confidence =
    numericFact(rightFacts.confidenceScore, 0) -
    numericFact(leftFacts.confidenceScore, 0);
  if (confidence !== 0) return confidence;
  const relevance =
    numericFact(rightFacts.goalRelevanceScore, 0) -
    numericFact(leftFacts.goalRelevanceScore, 0);
  if (relevance !== 0) return relevance;
  const priority =
    numericFact(leftFacts.rulePriority, 999) -
    numericFact(rightFacts.rulePriority, 999);
  if (priority !== 0) return priority;
  return (left.identityKey || left.type).localeCompare(
    right.identityKey || right.type,
  );
}

export async function generateRecommendations(
  userId: string,
  now = new Date(),
): Promise<PrismaRecommendation[]> {
  const facts = await computeRecommendationFacts(userId, now);
  const candidates = generateRecommendationCandidates(facts);
  const candidateByIdentity = new Map(
    candidates.map((candidate) => [candidate.identityKey, candidate]),
  );

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.recommendation.findMany({
      where: {
        userId,
        type: { in: MANAGED_RECOMMENDATION_TYPES },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    const activeRecommendations: PrismaRecommendation[] = [];

    const identities = [
      ...new Set([
        ...MANAGED_RECOMMENDATION_TYPES,
        ...candidates.map((candidate) => candidate.identityKey),
      ]),
    ];
    for (const identityKey of identities) {
      const candidate = candidateByIdentity.get(identityKey);
      const matching = existing.filter(
        (recommendation) =>
          (recommendation.identityKey || recommendation.type) === identityKey,
      );
      const active = matching.filter(
        (recommendation) => recommendation.status === 'active',
      );

      if (candidate === undefined) {
        if (active.length > 0) {
          await transaction.recommendation.updateMany({
            where: {
              userId,
              id: { in: active.map((recommendation) => recommendation.id) },
            },
            data: { status: 'archived', resolvedAt: now },
          });
        }
        continue;
      }

      if (active.length > 0) {
        const [current, ...duplicates] = active;

        if (current === undefined) continue;

        const updated = await transaction.recommendation.update({
          where: { id: current.id },
          data: {
            severity: candidate.severity,
            title: candidate.title,
            message: candidate.message,
            sourceFacts: persistedSourceFacts(
              candidate,
            ) as Prisma.InputJsonValue,
            identityKey: candidate.identityKey,
            conditionFingerprint: recommendationConditionFingerprint(candidate),
          },
        });
        activeRecommendations.push(updated);

        if (duplicates.length > 0) {
          await transaction.recommendation.updateMany({
            where: {
              userId,
              id: {
                in: duplicates.map((recommendation) => recommendation.id),
              },
            },
            data: { status: 'archived', resolvedAt: now },
          });
        }
        continue;
      }

      const fingerprint = recommendationConditionFingerprint(candidate);
      const dismissedRecently = matching.some(
        (recommendation) =>
          recommendation.status === 'dismissed' &&
          recommendation.dismissedAt !== null &&
          recommendation.conditionFingerprint === fingerprint &&
          facts.currentLocalDate <
            addLocalDays(
              localDate(recommendation.dismissedAt, facts.timezone),
              3,
            ),
      );

      if (dismissedRecently) continue;

      activeRecommendations.push(
        await transaction.recommendation.create({
          data: {
            userId,
            type: candidate.type,
            identityKey: candidate.identityKey,
            severity: candidate.severity,
            title: candidate.title,
            message: candidate.message,
            sourceFacts: persistedSourceFacts(
              candidate,
            ) as Prisma.InputJsonValue,
            conditionFingerprint: fingerprint,
            status: 'active',
          },
        }),
      );
    }

    const ranked = activeRecommendations.sort(comparePersistedRecommendations);
    const micronutrientIds = ranked
      .filter(
        (recommendation) =>
          recommendation.type === 'micronutrient_below_target',
      )
      .map((recommendation) => recommendation.id);
    const allowedMicronutrientId = micronutrientIds[0];
    const constrained = ranked
      .filter(
        (recommendation) =>
          recommendation.type !== 'micronutrient_below_target' ||
          recommendation.id === allowedMicronutrientId,
      )
      .slice(0, 3);
    return constrained;
  });
}
