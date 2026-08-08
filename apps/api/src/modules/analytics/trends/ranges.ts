import {
  type AnalyticsAggregation,
  type AnalyticsPeriod,
} from '@food-tracker/shared';
import { addLocalDays, localDateDifference } from '../../../lib/dates.js';

export interface ResolvedAnalyticsPeriod {
  startDate: string;
  endDate: string;
  dayCount: number;
  aggregation: Exclude<AnalyticsAggregation, 'automatic'>;
}

export interface ResolveAnalyticsPeriodInput {
  period: AnalyticsPeriod;
  today: string;
  firstEligibleDate: string | null;
  requestedAggregation?: AnalyticsAggregation;
}

function dayCountForPeriod(period: AnalyticsPeriod): number {
  return period.kind === 'relative'
    ? period.days
    : localDateDifference(period.endDate, period.startDate) + 1;
}

export function resolveAnalyticsAggregation(
  period: AnalyticsPeriod,
): Exclude<AnalyticsAggregation, 'automatic'> {
  const dayCount = dayCountForPeriod(period);
  if (dayCount <= 45) return 'daily';
  if (dayCount <= 180) return 'weekly';
  return 'monthly';
}

function validateRequestedAggregation(
  requested: AnalyticsAggregation,
  dayCount: number,
): Exclude<AnalyticsAggregation, 'automatic'> {
  if (requested === 'automatic') {
    return resolveAnalyticsAggregation({ kind: 'relative', days: dayCount });
  }
  if (requested === 'daily' && dayCount > 180) {
    throw new Error('Daily aggregation is not readable beyond 180 days');
  }
  if (requested === 'weekly' && dayCount < 14) {
    throw new Error('Weekly aggregation requires at least 14 days');
  }
  if (requested === 'monthly' && dayCount < 90) {
    throw new Error('Monthly aggregation requires at least 90 days');
  }
  return requested;
}

export function resolveAnalyticsPeriod({
  period,
  today,
  firstEligibleDate,
  requestedAggregation = 'automatic',
}: ResolveAnalyticsPeriodInput): ResolvedAnalyticsPeriod {
  const startDate =
    period.kind === 'relative'
      ? addLocalDays(today, -(period.days - 1))
      : period.startDate;
  const endDate = period.kind === 'relative' ? today : period.endDate;

  if (endDate > today)
    throw new Error('Analytics ranges cannot include future dates');
  if (startDate > endDate)
    throw new Error('Analytics range start must not follow its end');
  if (firstEligibleDate !== null && startDate < firstEligibleDate) {
    throw new Error(
      'Analytics ranges cannot begin before the first eligible date',
    );
  }

  const dayCount = localDateDifference(endDate, startDate) + 1;
  return {
    startDate,
    endDate,
    dayCount,
    aggregation: validateRequestedAggregation(requestedAggregation, dayCount),
  };
}
