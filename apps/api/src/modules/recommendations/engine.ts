import type {
  RecommendationSeverity,
  RecommendationType,
} from '@food-tracker/shared';
import type { RecommendationAnalyticsFacts } from '../analytics/recommendation-facts.js';
import { MIN_LOGGED_DAYS_FOR_INTAKE_RECOMMENDATIONS } from '../analytics/recommendation-facts.js';
import { roundTo } from '../../lib/serializers.js';

export interface RecommendationCandidate {
  type: RecommendationType;
  identityKey: string;
  severity: RecommendationSeverity;
  goalRelevanceScore: 0 | 1 | 2 | 3;
  rulePriority: number;
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
  'micronutrient_below_target',
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

  for (const micronutrient of facts.micronutrients) {
    const difference = roundTo(micronutrient.target - micronutrient.average, 1);
    const severity =
      difference >= micronutrient.target * 0.5
        ? 'high'
        : difference >= micronutrient.target * 0.25
          ? 'medium'
          : difference >= 0.1
            ? 'low'
            : null;
    if (severity === null) continue;
    candidates.push({
      type: 'micronutrient_below_target',
      identityKey: `micronutrient_below_target:${micronutrient.nutrientKey}`,
      severity,
      goalRelevanceScore: 1,
      rulePriority: 50,
      title: `${micronutrient.nutrientKey} is below target`,
      message: `Your logged ${micronutrient.nutrientKey} intake has been below your reference target recently.`,
      sourceFacts: { ...micronutrient, difference },
    });
  }

  if (facts.intakeRecommendationsAllowed && facts.targetProteinGrams !== null) {
    const differenceGrams = roundTo(
      facts.targetProteinGrams - facts.averageProteinGrams,
      1,
    );
    const severity = proteinSeverity(differenceGrams);

    if (severity !== null) {
      candidates.push({
        type: 'protein_low',
        identityKey: 'protein_low',
        severity,
        goalRelevanceScore: 2,
        rulePriority: 20,
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
          identityKey: 'calories_under_target',
          severity,
          goalRelevanceScore: facts.goalType === 'gain' ? 3 : 2,
          rulePriority: 10,
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
          identityKey: 'calories_over_target',
          severity,
          goalRelevanceScore: facts.goalType === 'lose' ? 3 : 2,
          rulePriority: 11,
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
      identityKey: 'missing_recent_weight_logs',
      severity: 'medium',
      goalRelevanceScore: facts.goalType === null ? 1 : 2,
      rulePriority: 30,
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
      identityKey: 'inconsistent_food_logging',
      severity: loggingRecommendationSeverity,
      goalRelevanceScore: 1,
      rulePriority: 40,
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
