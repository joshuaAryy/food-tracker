import type {
  DashboardSummary,
  TrackingPreferences,
} from '@food-tracker/shared';

export const progressRegressionSummary = {
  date: '2026-08-11',
  foodLogCount: 1,
  caloriesConsumed: 1200,
  calorieTarget: 2000,
  caloriesRemaining: 800,
  proteinConsumed: 80,
  proteinTarget: 120,
  proteinRemaining: 40,
  latestWeightLb: 129,
  trackingMode: 'simple',
} satisfies DashboardSummary;

export const progressRegressionPreferences = {
  mode: 'simple',
  waterTrackingEnabled: true,
} satisfies TrackingPreferences;

export const progressRegressionNextModePreferences = {
  mode: 'complex',
  waterTrackingEnabled: true,
} satisfies TrackingPreferences;

export const progressRegressionReporting = {
  currentStreak: { loggedDays: 2 },
} as const;
