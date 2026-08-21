import {
  COLUMN_BACKED_NUTRIENT_KEYS,
  NUTRIENT_CATALOG,
  type AnalyticsContributorsResponse,
  type TrendQueryInput,
} from '@food-tracker/shared';
import { DEFAULT_TIMEZONE } from '@food-tracker/shared';
import { localDate, localDateRange } from '../../../lib/dates.js';
import { prisma } from '../../../lib/prisma.js';
import { resolveAnalyticsPeriod } from './ranges.js';

type ColumnMetric = (typeof COLUMN_BACKED_NUTRIENT_KEYS)[number];

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function columnValue(
  log: Record<string, unknown>,
  metric: ColumnMetric,
): number | null {
  return numberOrNull(log[metric]);
}

/** Calculates food attribution from immutable FoodLog snapshots only. */
export async function computeAnalyticsContributors(
  userId: string,
  query: TrendQueryInput,
  options: { includeAll?: boolean } = {},
): Promise<AnalyticsContributorsResponse> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const firstLog = await prisma.foodLog.findFirst({
    where: { userId },
    orderBy: [{ loggedAt: 'asc' }, { createdAt: 'asc' }],
    select: { loggedAt: true },
  });
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const resolved = resolveAnalyticsPeriod({
    period: query.period,
    today: localDate(new Date(), timezone),
    firstEligibleDate:
      firstLog === null ? null : localDate(firstLog.loggedAt, timezone),
    requestedAggregation: query.aggregation,
  });
  const logs = await prisma.foodLog.findMany({
    where: {
      userId,
      loggedAt: localDateRange(timezone, {
        startDate: resolved.startDate,
        endDate: resolved.endDate,
      }),
    },
    select: {
      id: true,
      foodName: true,
      calories: true,
      protein: true,
      carbs: true,
      fat: true,
      fiber: true,
      sugar: true,
      sodium: true,
      nutrients: { select: { nutrientKey: true, amount: true } },
    },
  });
  const byFood = new Map<string, { value: number; firstId: string }>();
  for (const log of logs) {
    const value = COLUMN_BACKED_NUTRIENT_KEYS.includes(
      query.primaryMetric as ColumnMetric,
    )
      ? columnValue(log, query.primaryMetric as ColumnMetric)
      : NUTRIENT_CATALOG[query.primaryMetric as keyof typeof NUTRIENT_CATALOG]
            ?.storage === 'normalized'
        ? numberOrNull(
            log.nutrients.find(
              (nutrient) => nutrient.nutrientKey === query.primaryMetric,
            )?.amount,
          )
        : null;
    if (value === null) continue;
    const current = byFood.get(log.foodName) ?? { value: 0, firstId: log.id };
    current.value += value;
    if (log.id.localeCompare(current.firstId) < 0) current.firstId = log.id;
    byFood.set(log.foodName, current);
  }
  const all = [...byFood.entries()]
    .map(([foodName, contributor]) => ({ foodName, ...contributor }))
    .sort(
      (left, right) =>
        right.value - left.value ||
        left.foodName.localeCompare(right.foodName) ||
        left.firstId.localeCompare(right.firstId),
    );
  const recordedTotal = all.reduce(
    (total, contributor) => total + contributor.value,
    0,
  );
  const displayed = (options.includeAll ? all : all.slice(0, 3)).map(
    ({ foodName, value }) => ({
      foodName,
      value,
      percentage: recordedTotal === 0 ? 0 : value / recordedTotal,
    }),
  );
  const remainderValue = all
    .slice(3)
    .reduce((total, contributor) => total + contributor.value, 0);
  return {
    metric: query.primaryMetric,
    resolvedRange: { startDate: resolved.startDate, endDate: resolved.endDate },
    recordedTotal,
    contributors: displayed,
    remainder:
      options.includeAll || all.length <= 3
        ? null
        : {
            value: remainderValue,
            percentage:
              recordedTotal === 0 ? 0 : remainderValue / recordedTotal,
          },
    hasMore: all.length > 3,
  };
}
