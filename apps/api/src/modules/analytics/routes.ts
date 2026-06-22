import { Router } from 'express';
import {
  advancedAnalyticsQuerySchema,
  dashboardSummaryQuerySchema,
  DEFAULT_TIMEZONE,
  type DashboardSummary,
} from '@food-tracker/shared';
import type { z } from 'zod';
import { currentUserId } from '../../lib/auth.js';
import { localDate, localDateRange } from '../../lib/dates.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import { roundTo } from '../../lib/serializers.js';
import { validateQuery, validatedQuery } from '../../middleware/validate.js';
import { computeAdvancedAnalytics } from './advanced.js';

type DashboardQuery = z.infer<typeof dashboardSummaryQuerySchema>;
type AdvancedAnalyticsQuery = z.infer<typeof advancedAnalyticsQuerySchema>;

export const analyticsRouter = Router();
export const advancedAnalyticsRouter = Router();

advancedAnalyticsRouter.get(
  '/advanced',
  validateQuery(advancedAnalyticsQuerySchema),
  async (_request, response) => {
    const analytics = await computeAdvancedAnalytics(
      currentUserId(response),
      validatedQuery<AdvancedAnalyticsQuery>(response),
    );

    sendSuccess(response, analytics);
  },
);

analyticsRouter.get(
  '/summary',
  validateQuery(dashboardSummaryQuerySchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const query = validatedQuery<DashboardQuery>(response);
    const [profile, goals, preferences, latestWeight] = await Promise.all([
      prisma.userProfile.findUnique({
        where: { userId },
        select: { timezone: true },
      }),
      prisma.userGoal.findUnique({ where: { userId } }),
      prisma.trackingPreference.findUnique({ where: { userId } }),
      prisma.weightLog.findFirst({
        where: { userId },
        orderBy: [{ loggedAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
    const date = query.date ?? localDate(new Date(), timezone);
    const range = localDateRange(timezone, { date });
    const totals = await prisma.foodLog.aggregate({
      where: { userId, loggedAt: range },
      _count: { _all: true },
      _sum: { calories: true, protein: true },
    });
    const caloriesConsumed = totals._sum.calories ?? 0;
    const proteinConsumed = totals._sum.protein?.toNumber() ?? 0;
    const calorieTarget = goals?.targetCalories ?? null;
    const proteinTarget = goals?.targetProteinGrams?.toNumber() ?? null;
    const summary: DashboardSummary = {
      date,
      foodLogCount: totals._count._all,
      caloriesConsumed,
      calorieTarget,
      caloriesRemaining:
        calorieTarget === null ? null : calorieTarget - caloriesConsumed,
      proteinConsumed: roundTo(proteinConsumed, 1),
      proteinTarget,
      proteinRemaining:
        proteinTarget === null
          ? null
          : roundTo(proteinTarget - proteinConsumed, 1),
      latestWeightLb: latestWeight?.weightLb.toNumber() ?? null,
      trackingMode: preferences?.mode ?? 'simple',
    };

    sendSuccess(response, summary);
  },
);
