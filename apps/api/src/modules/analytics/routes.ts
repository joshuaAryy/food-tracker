import { Router } from 'express';
import {
  advancedAnalyticsQuerySchema,
  COLUMN_BACKED_NUTRIENT_KEYS,
  dashboardSummaryQuerySchema,
  DEFAULT_TIMEZONE,
  NUTRIENT_CATALOG,
  type DashboardSummary,
  type DailyNutrientTotals,
  type NutrientAmount,
  type NutrientKey,
} from '@food-tracker/shared';
import type { z } from 'zod';
import { currentUserId } from '../../lib/auth.js';
import { localDate, localDateRange } from '../../lib/dates.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import { roundTo } from '../../lib/serializers.js';
import { validateQuery, validatedQuery } from '../../middleware/validate.js';
import { computeAdvancedAnalytics } from './advanced.js';
import { resolveUserReportingGoals } from '../nutritionTargets/reporting-adapter.js';
import { resolveUserNutritionTargets } from '../nutritionTargets/service.js';

type DashboardQuery = z.infer<typeof dashboardSummaryQuerySchema>;
type AdvancedAnalyticsQuery = z.infer<typeof advancedAnalyticsQuerySchema>;

export const analyticsRouter = Router();
export const advancedAnalyticsRouter = Router();

advancedAnalyticsRouter.get(
  '/nutrients/daily',
  validateQuery(dashboardSummaryQuerySchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const query = validatedQuery<DashboardQuery>(response);
    const now = new Date();
    const [profile, reportingGoals] = await Promise.all([
      prisma.userProfile.findUnique({
        where: { userId },
        select: { timezone: true },
      }),
      resolveUserReportingGoals(userId, now),
    ]);
    const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
    const date = query.date ?? localDate(new Date(), timezone);
    const range = localDateRange(timezone, { date });
    const [columnTotals, normalizedTotals] = await Promise.all([
      prisma.foodLog.aggregate({
        where: { userId, loggedAt: range },
        _count: { _all: true },
        _sum: {
          calories: true,
          protein: true,
          carbs: true,
          fat: true,
          fiber: true,
          sugar: true,
          sodium: true,
        },
      }),
      prisma.foodLogNutrient.groupBy({
        by: ['nutrientKey', 'unit'],
        where: { foodLog: { userId, loggedAt: range } },
        _sum: { amount: true },
      }),
    ]);
    const nutrients: Partial<Record<NutrientKey, NutrientAmount>> = {};

    if (columnTotals._count._all > 0) {
      nutrients.calories = {
        amount: columnTotals._sum.calories ?? 0,
        unit: NUTRIENT_CATALOG.calories.defaultUnit,
      };
      nutrients.protein = {
        amount: roundTo(columnTotals._sum.protein?.toNumber() ?? 0, 1),
        unit: NUTRIENT_CATALOG.protein.defaultUnit,
      };
    }

    for (const key of COLUMN_BACKED_NUTRIENT_KEYS) {
      if (key === 'calories' || key === 'protein') continue;

      const amount = columnTotals._sum[key];
      if (amount === null) continue;

      nutrients[key] = {
        amount:
          typeof amount === 'number'
            ? amount
            : roundTo(amount.toNumber(), key === 'sodium' ? 0 : 1),
        unit: NUTRIENT_CATALOG[key].defaultUnit,
      };
    }

    for (const total of normalizedTotals) {
      if (total._sum.amount === null) continue;

      nutrients[total.nutrientKey] = {
        amount: roundTo(total._sum.amount.toNumber(), 4),
        unit: total.unit,
      };
    }

    const percentages: DailyNutrientTotals['percentages'] = Object.fromEntries(
      Object.entries(nutrients).map(([key, amount]) => {
        const resolvedGoal = reportingGoals[key as NutrientKey];
        const percentage =
          amount === undefined ||
          resolvedGoal?.value === null ||
          resolvedGoal?.value === undefined ||
          resolvedGoal.value <= 0
            ? null
            : roundTo((amount.amount / resolvedGoal.value) * 100, 1);
        return [key, percentage];
      }),
    );
    const totals: DailyNutrientTotals = {
      date,
      nutrients,
      reportingGoals,
      percentages,
    };

    sendSuccess(response, totals);
  },
);

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
    const now = new Date();
    const [profile, preferences, latestWeight, effectiveTargets] =
      await Promise.all([
        prisma.userProfile.findUnique({
          where: { userId },
          select: { timezone: true },
        }),
        prisma.trackingPreference.findUnique({ where: { userId } }),
        prisma.weightLog.findFirst({
          where: { userId },
          orderBy: [
            { loggedAt: 'desc' },
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
        }),
        resolveUserNutritionTargets(userId, now),
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
    const calorieTarget = effectiveTargets.calories?.effectiveValue ?? null;
    const proteinTarget = effectiveTargets.protein?.effectiveValue ?? null;
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
