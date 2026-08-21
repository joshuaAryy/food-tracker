import { type AnalyticsCoverageFilter } from '@food-tracker/shared';

interface LoggingDayCoverageInput {
  loggingDayState: 'complete' | 'partial' | 'unlogged';
  loggingDayPhase: 'closed' | 'in_progress';
  metricDataState: 'recorded' | 'partial' | 'unknown' | null;
}

/**
 * Coverage filters are intentionally based only on FoodLog completeness. The
 * metric state is carried for callers to preserve, never to change admission.
 */
export function includesLoggingDay(
  day: LoggingDayCoverageInput,
  filter: AnalyticsCoverageFilter,
): boolean {
  if (day.loggingDayState === 'unlogged') return false;

  switch (filter) {
    case 'all_logged_days':
      return true;
    case 'complete_and_partial':
      return day.loggingDayPhase === 'closed';
    case 'complete_only':
      return (
        day.loggingDayPhase === 'closed' && day.loggingDayState === 'complete'
      );
  }
}
