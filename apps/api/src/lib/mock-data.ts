import type {
  DashboardSummary,
  FoodLog,
  Goals,
  Profile,
  Recommendation,
  TrackingPreferences,
  WeightLog,
} from '@food-tracker/shared';

const timestamp = '2026-06-14T12:00:00.000Z';

export const mockProfile: Profile = {
  age: 30,
  sex: 'unspecified',
  heightInches: 70,
  timezone: 'America/Toronto',
  startingWeightLb: 185.5,
};

export const mockGoals: Goals = {
  goalType: 'maintain',
  targetWeightLb: 180,
  targetCalories: 2200,
  targetProteinGrams: 150,
};

export const mockTrackingPreferences: TrackingPreferences = {
  mode: 'simple',
  waterTrackingEnabled: false,
};

export const mockFoodLogs: FoodLog[] = [];
export const mockWeightLogs: WeightLog[] = [];
export const mockRecommendations: Recommendation[] = [];

export const mockDashboardSummary: DashboardSummary = {
  date: '2026-06-14',
  caloriesConsumed: 0,
  calorieTarget: 2200,
  caloriesRemaining: 2200,
  proteinConsumed: 0,
  proteinTarget: 150,
  proteinRemaining: 150,
  latestWeightLb: null,
  trackingMode: 'simple',
};

export function mockId(prefix: string): string {
  return `${prefix}-mock-id`;
}

export function mockTimestamp(): string {
  return timestamp;
}
