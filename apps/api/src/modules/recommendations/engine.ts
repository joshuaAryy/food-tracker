import type {
  RecommendationSeverity,
  RecommendationType,
} from '@food-tracker/shared';
import type { RecommendationAnalyticsFacts } from '../analytics/recommendation-facts.js';
import { MIN_LOGGED_DAYS_FOR_INTAKE_RECOMMENDATIONS } from '../analytics/recommendation-facts.js';
import { roundTo } from '../../lib/serializers.js';

export interface RecommendationCandidate {
  type: RecommendationType;
  severity: RecommendationSeverity;
  title: string;
  message: string;
  sourceFacts: Record<string, string | number | null>;
}

export const MANAGED_RECOMMENDATION_TYPES: RecommendationType[] = [
  'protein_low',
  'calories_under_target',
  'calories_over_target',
  'missing_recent_weight_logs',
  'inconsistent_food_logging',
];

function proteinSeverity(
  differenceGrams: number,
): RecommendationSeverity | null {
  if (differenceGrams >= 50) return 'high';
  if (differenceGrams >= 25) return 'medium';
  if (differenceGrams >= 10) return 'low';
  return null;
}

function calorieSeverity(
  differenceCalories: number,
): RecommendationSeverity | null {
  if (differenceCalories >= 600) return 'high';
  if (differenceCalories >= 300) return 'medium';
  if (differenceCalories >= 150) return 'low';
  return null;
}

function loggingSeverity(loggedDays: number): RecommendationSeverity | null {
  if (loggedDays === 0) return 'high';
  if (loggedDays <= 2) return 'medium';
  if (loggedDays === 3) return 'low';
  return null;
}

export function generateRecommendationCandidates(
  facts: RecommendationAnalyticsFacts,
): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = [];

  if (facts.intakeRecommendationsAllowed && facts.targetProteinGrams !== null) {
    const differenceGrams = roundTo(
      facts.targetProteinGrams - facts.averageProteinGrams,
      1,
    );
    const severity = proteinSeverity(differenceGrams);

    if (severity !== null) {
      candidates.push({
        type: 'protein_low',
        severity,
        title: 'Protein is below target',
        message: `You are averaging ${differenceGrams}g below your protein target over the last ${facts.daysAnalyzed} days.`,
        sourceFacts: {
          targetProteinGrams: facts.targetProteinGrams,
          averageProteinGrams: facts.averageProteinGrams,
          differenceGrams,
          daysAnalyzed: facts.daysAnalyzed,
          loggedDays: facts.loggedDays,
        },
      });
    }
  }

  if (
    facts.intakeRecommendationsAllowed &&
    facts.targetCalories !== null &&
    facts.goalType !== null
  ) {
    const calorieDifference = roundTo(
      facts.targetCalories - facts.averageCalories,
      0,
    );

    if (facts.goalType === 'gain' || facts.goalType === 'maintain') {
      const severity = calorieSeverity(calorieDifference);

      if (severity !== null) {
        candidates.push({
          type: 'calories_under_target',
          severity,
          title: 'Calories are below target',
          message: `You are averaging ${calorieDifference} kcal below your calorie target over the last ${facts.daysAnalyzed} days.`,
          sourceFacts: {
            targetCalories: facts.targetCalories,
            averageCalories: facts.averageCalories,
            differenceCalories: calorieDifference,
            goalType: facts.goalType,
            daysAnalyzed: facts.daysAnalyzed,
            loggedDays: facts.loggedDays,
          },
        });
      }
    }

    if (facts.goalType === 'lose' || facts.goalType === 'maintain') {
      const differenceCalories = -calorieDifference;
      const severity = calorieSeverity(differenceCalories);

      if (severity !== null) {
        candidates.push({
          type: 'calories_over_target',
          severity,
          title: 'Calories are above target',
          message: `You are averaging ${differenceCalories} kcal above your calorie target over the last ${facts.daysAnalyzed} days.`,
          sourceFacts: {
            targetCalories: facts.targetCalories,
            averageCalories: facts.averageCalories,
            differenceCalories,
            goalType: facts.goalType,
            daysAnalyzed: facts.daysAnalyzed,
            loggedDays: facts.loggedDays,
          },
        });
      }
    }
  }

  if (!facts.hasRecentWeightLog) {
    candidates.push({
      type: 'missing_recent_weight_logs',
      severity: 'medium',
      title: 'A recent weight log is missing',
      message:
        facts.lastWeightLoggedAt === null
          ? 'No weight has been logged yet. Add a weight entry to keep progress current.'
          : `Your last weight entry was ${facts.daysSinceLastWeightLog} days ago.`,
      sourceFacts: {
        lastWeightLoggedAt: facts.lastWeightLoggedAt,
        daysSinceLastWeightLog: facts.daysSinceLastWeightLog,
      },
    });
  }

  const loggingRecommendationSeverity = loggingSeverity(facts.loggedDays);

  if (loggingRecommendationSeverity !== null) {
    candidates.push({
      type: 'inconsistent_food_logging',
      severity: loggingRecommendationSeverity,
      title: 'Food logging has been inconsistent',
      message: `You logged food on ${facts.loggedDays} of the last ${facts.expectedDays} days.`,
      sourceFacts: {
        loggedDays: facts.loggedDays,
        expectedDays: facts.expectedDays,
        missingDays: facts.missingDays,
        minimumLoggedDaysForIntakeRecommendations:
          MIN_LOGGED_DAYS_FOR_INTAKE_RECOMMENDATIONS,
      },
    });
  }

  return candidates;
}
