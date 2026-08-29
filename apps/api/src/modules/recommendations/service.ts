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
            sourceFacts: candidate.sourceFacts as Prisma.InputJsonValue,
            identityKey: candidate.identityKey,
            conditionFingerprint: createHash('sha256')
              .update(
                JSON.stringify({
                  identityKey: candidate.identityKey,
                  severity: candidate.severity,
                  facts: candidate.sourceFacts,
                }),
              )
              .digest('hex'),
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

      const fingerprint = createHash('sha256')
        .update(
          JSON.stringify({
            identityKey: candidate.identityKey,
            severity: candidate.severity,
            facts: candidate.sourceFacts,
          }),
        )
        .digest('hex');
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
            sourceFacts: candidate.sourceFacts as Prisma.InputJsonValue,
            conditionFingerprint: fingerprint,
            status: 'active',
          },
        }),
      );
    }

    const severityRank = { high: 3, medium: 2, low: 1 } as const;
    const ranked = activeRecommendations.sort((left, right) => {
      const severity =
        severityRank[right.severity] - severityRank[left.severity];
      if (severity !== 0) return severity;
      const leftCandidate = candidateByIdentity.get(
        left.identityKey || left.type,
      );
      const rightCandidate = candidateByIdentity.get(
        right.identityKey || right.type,
      );
      const relevance =
        (rightCandidate?.goalRelevanceScore ?? 0) -
        (leftCandidate?.goalRelevanceScore ?? 0);
      if (relevance !== 0) return relevance;
      const priority =
        (leftCandidate?.rulePriority ?? 999) -
        (rightCandidate?.rulePriority ?? 999);
      if (priority !== 0) return priority;
      return (left.identityKey || left.type).localeCompare(
        right.identityKey || right.type,
      );
    });
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
    const overflow = ranked.filter(
      (recommendation) =>
        !constrained.some((kept) => kept.id === recommendation.id),
    );
    if (overflow.length > 0) {
      await transaction.recommendation.updateMany({
        where: {
          userId,
          id: { in: overflow.map((recommendation) => recommendation.id) },
        },
        data: { status: 'archived', resolvedAt: now },
      });
    }
    return constrained;
  });
}
