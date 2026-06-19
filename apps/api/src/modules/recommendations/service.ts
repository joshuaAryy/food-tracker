import {
  Prisma,
  type Recommendation as PrismaRecommendation,
} from '@prisma/client';
import { localDate } from '../../lib/dates.js';
import { prisma } from '../../lib/prisma.js';
import { computeRecommendationFacts } from '../analytics/recommendation-facts.js';
import {
  generateRecommendationCandidates,
  MANAGED_RECOMMENDATION_TYPES,
} from './engine.js';

export async function generateRecommendations(
  userId: string,
  now = new Date(),
): Promise<PrismaRecommendation[]> {
  const facts = await computeRecommendationFacts(userId, now);
  const candidates = generateRecommendationCandidates(facts);
  const candidateByType = new Map(
    candidates.map((candidate) => [candidate.type, candidate]),
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

    for (const type of MANAGED_RECOMMENDATION_TYPES) {
      const candidate = candidateByType.get(type);
      const matching = existing.filter(
        (recommendation) => recommendation.type === type,
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
            data: { status: 'archived' },
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
            data: { status: 'archived' },
          });
        }
        continue;
      }

      const dismissedToday = matching.some(
        (recommendation) =>
          recommendation.status === 'dismissed' &&
          localDate(recommendation.updatedAt, facts.timezone) ===
            facts.currentLocalDate,
      );

      if (dismissedToday) continue;

      activeRecommendations.push(
        await transaction.recommendation.create({
          data: {
            userId,
            type: candidate.type,
            severity: candidate.severity,
            title: candidate.title,
            message: candidate.message,
            sourceFacts: candidate.sourceFacts as Prisma.InputJsonValue,
            status: 'active',
          },
        }),
      );
    }

    return activeRecommendations.sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );
  });
}
