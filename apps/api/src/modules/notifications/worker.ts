import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { localDate, localDateRange } from '../../lib/dates.js';
import { notificationEligibility } from './policy.js';
import { sendExpoPushNotifications } from './expo-client.js';
import { processDueNotificationReceipts } from './receipts.js';
import { comparePersistedRecommendations } from '../recommendations/service.js';
import type { Recommendation } from '@prisma/client';

const PAGE_SIZE = 100;
const MAX_RUNTIME_MS = 8 * 60 * 1000;
const STOP_STARTING_PAGES_MS = 7 * 60 * 1000;
const USER_CONCURRENCY = 5;

function remainingWorkerBudget(deadlineAt: number): number {
  return Math.max(1, deadlineAt - Date.now());
}

export function recommendationsForTrackingMode<
  T extends Pick<Recommendation, 'type'>,
>(
  recommendations: readonly T[],
  mode: 'simple' | 'complex' | null | undefined,
): T[] {
  return mode === 'complex'
    ? [...recommendations]
    : recommendations.filter(
        (item) => item.type !== 'micronutrient_below_target',
      );
}

export function notificationRouteForKind(
  kind: 'recommendation' | 'logging_reminder',
): '/insights' | '/food-log' {
  return kind === 'logging_reminder' ? '/food-log' : '/insights';
}

export interface NotificationWorkerOptions {
  now?: Date;
  dryRun?: boolean;
  acceptanceUserId?: string;
}

async function evaluateUser(
  userId: string,
  now: Date,
  dryRun: boolean,
  deadlineAt: number,
): Promise<boolean> {
  const [
    profile,
    preference,
    trackingPreference,
    lastFoodLog,
    events,
    recommendation,
  ] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    }),
    prisma.notificationPreference.findUnique({ where: { userId } }),
    prisma.trackingPreference.findUnique({
      where: { userId },
      select: { mode: true },
    }),
    prisma.foodLog.findFirst({
      where: { userId },
      orderBy: [{ loggedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: { loggedAt: true },
    }),
    prisma.notificationEvent.findMany({
      where: {
        userId,
        claimedAt: { gte: new Date(now.getTime() - 168 * 60 * 60 * 1000) },
      },
      select: { class: true, claimedAt: true, localDate: true },
    }),
    prisma.recommendation.findMany({
      where: { userId, status: 'active' },
      select: {
        id: true,
        identityKey: true,
        type: true,
        severity: true,
        sourceFacts: true,
      },
    }),
  ]);
  const timezone = profile?.timezone ?? 'America/Toronto';
  const currentLocalDate = localDate(now, timezone);
  const todayLogs = await prisma.foodLog.count({
    where: {
      userId,
      loggedAt: localDateRange(timezone, { date: currentLocalDate }),
    },
  });
  const rankedRecommendations = recommendationsForTrackingMode(
    recommendation,
    trackingPreference?.mode,
  )
    .sort(comparePersistedRecommendations)
    .slice(0, 1);
  const eligibility = notificationEligibility({
    now,
    timezone,
    localDate: currentLocalDate,
    recommendationEnabled: preference?.recommendationInsightsEnabled ?? false,
    reminderEnabled: preference?.loggingRemindersEnabled ?? false,
    todayIncomplete: todayLogs === 0,
    lastFoodLogAt: lastFoodLog?.loggedAt ?? null,
    claimedEvents: events.map((event) => ({
      class: event.class,
      claimedAt: event.claimedAt,
      localDate: event.localDate.toISOString().slice(0, 10),
    })),
    activeRecommendation: rankedRecommendations[0] ?? null,
  });
  if (eligibility.kind === 'none' || dryRun) return eligibility.kind !== 'none';

  const localDateValue = new Date(`${currentLocalDate}T00:00:00.000Z`);
  const identityKey =
    eligibility.kind === 'recommendation'
      ? `recommendation:${eligibility.recommendationId}`
      : `logging:${currentLocalDate}`;
  const dedupeKey = `${userId}:${identityKey}:${currentLocalDate}`;
  let event;
  try {
    event = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`,
      );
      const existing = await transaction.notificationEvent.findFirst({
        where: { userId, localDate: localDateValue },
      });
      if (existing !== null) return null;
      return transaction.notificationEvent.create({
        data: {
          userId,
          class:
            eligibility.kind === 'recommendation'
              ? 'recommendation_insight'
              : 'logging_reminder',
          localDate: localDateValue,
          identityKey,
          dedupeKey,
          recommendationId:
            eligibility.kind === 'recommendation'
              ? eligibility.recommendationId
              : null,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      return false;
    throw error;
  }
  if (event === null) return false;

  const installations = await prisma.notificationInstallation.findMany({
    where: {
      userId,
      disabledAt: null,
      expoPushToken: { not: null },
      tokenHash: { not: null },
    },
  });
  for (const installation of installations) {
    if (Date.now() >= deadlineAt) break;
    if (installation.expoPushToken === null || installation.tokenHash === null)
      continue;
    const [ticket] = await sendExpoPushNotifications(
      [
        {
          to: installation.expoPushToken,
          title: 'Food Tracker',
          body:
            eligibility.kind === 'recommendation'
              ? 'A new nutrition insight is ready.'
              : 'A logging reminder is ready.',
          data:
            eligibility.kind === 'recommendation'
              ? {
                  route: notificationRouteForKind('recommendation'),
                  recommendationId: eligibility.recommendationId,
                }
              : { route: notificationRouteForKind('logging_reminder') },
        },
      ],
      remainingWorkerBudget(deadlineAt),
    );
    await prisma.notificationDeliveryAttempt.create({
      data: {
        notificationEventId: event.id,
        notificationInstallationId: installation.id,
        tokenHash: installation.tokenHash,
        expoTicketId: ticket?.id ?? null,
        status: ticket?.status === 'ok' ? 'submitted' : 'failed',
        submittedAt: ticket?.status === 'ok' ? now : null,
        nextReceiptCheckAt:
          ticket?.status === 'ok'
            ? new Date(now.getTime() + 15 * 60 * 1000)
            : null,
        errorCode: ticket?.details?.error ?? null,
      },
    });
  }
  await prisma.notificationEvent.update({
    where: { id: event.id },
    data: {
      status: installations.length > 0 ? 'submitted' : 'failed',
      submittedAt: installations.length > 0 ? now : null,
    },
  });
  return true;
}

export async function runNotificationWorker(
  options: NotificationWorkerOptions = {},
): Promise<{ evaluated: number; claimed: number }> {
  const started = Date.now();
  const deadlineAt = started + MAX_RUNTIME_MS;
  const now = options.now ?? new Date();
  await processDueNotificationReceipts(now, {
    timeoutMs: remainingWorkerBudget(deadlineAt),
    deadlineAt,
  });
  let cursor = options.acceptanceUserId;
  if (!options.acceptanceUserId) {
    const checkpoint = await prisma.notificationWorkerCheckpoint.findUnique({
      where: { key: 'default' },
    });
    cursor = checkpoint?.cursorUserId ?? undefined;
  }
  let evaluated = 0;
  let claimed = 0;
  while (
    Date.now() - started < STOP_STARTING_PAGES_MS &&
    Date.now() < deadlineAt
  ) {
    const users = options.acceptanceUserId
      ? await prisma.user.findMany({
          where: { id: options.acceptanceUserId },
          take: 1,
          select: { id: true },
        })
      : await prisma.user.findMany({
          ...(cursor ? { where: { id: { gt: cursor } } } : {}),
          orderBy: { id: 'asc' },
          take: PAGE_SIZE,
          select: { id: true },
        });
    if (users.length === 0) {
      // A full final page leaves the cursor at the last user. Reset on the
      // next empty page so the next invocation starts a fresh complete cycle.
      if (!options.acceptanceUserId && cursor !== undefined) {
        cursor = undefined;
        await prisma.notificationWorkerCheckpoint.update({
          where: { key: 'default' },
          data: { cursorUserId: null, updatedAt: now },
        });
      }
      break;
    }
    let pageComplete = true;
    let processedThrough: string | undefined;
    for (let index = 0; index < users.length; index += USER_CONCURRENCY) {
      if (Date.now() >= deadlineAt) {
        pageComplete = false;
        break;
      }
      const batch = users.slice(index, index + USER_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (user) => ({
          claimed: await evaluateUser(
            user.id,
            now,
            options.dryRun ?? false,
            deadlineAt,
          ),
        })),
      );
      evaluated += results.length;
      claimed += results.filter((result) => result.claimed).length;
      processedThrough = batch[batch.length - 1]?.id;
    }
    if (options.acceptanceUserId) break;
    cursor = processedThrough;
    await prisma.notificationWorkerCheckpoint.upsert({
      where: { key: 'default' },
      update: { cursorUserId: cursor ?? null, updatedAt: now },
      create: {
        key: 'default',
        cursorUserId: cursor ?? null,
        updatedAt: now,
      },
    });
    if (!pageComplete) break;
    if (users.length < PAGE_SIZE) {
      await prisma.notificationWorkerCheckpoint.update({
        where: { key: 'default' },
        data: { cursorUserId: null, updatedAt: now },
      });
      break;
    }
    if (Date.now() - started >= STOP_STARTING_PAGES_MS) break;
  }
  return { evaluated, claimed };
}
