import { describe, expect, it } from 'vitest';
import {
  generateRecommendationCandidates,
  type RecommendationCandidate,
} from '../src/modules/recommendations/engine.js';
import type { RecommendationAnalyticsFacts } from '../src/modules/analytics/recommendation-facts.js';
import {
  comparePersistedRecommendations,
  recommendationConditionFingerprint,
} from '../src/modules/recommendations/service.js';

const baseFacts: RecommendationAnalyticsFacts = {
  timezone: 'America/Toronto',
  currentLocalDate: '2026-08-29',
  daysAnalyzed: 7,
  targetCalories: 2200,
  targetCaloriesSource: 'personalized',
  targetProteinGrams: 140,
  targetProteinSource: 'personalized',
  goalType: 'gain',
  targetWeightLb: 180,
  targetRateLbPerWeek: 0.5,
  trackingMode: 'complex',
  currentWeightLb: 170,
  weightTrendLbPerWeek: 0.1,
  averageCalories: 2200,
  averageProteinGrams: 140,
  loggedDays: 7,
  expectedDays: 7,
  missingDays: 0,
  intakeRecommendationsAllowed: true,
  lastWeightLoggedAt: '2026-08-29T12:00:00.000Z',
  daysSinceLastWeightLog: 0,
  hasRecentWeightLog: true,
  hydration: { averageMl: 2000, recordedDays: 7, eligibleDays: 7 },
  micronutrients: [],
};

function types(candidates: RecommendationCandidate[]): string[] {
  return candidates.map((candidate) => candidate.type);
}

describe('recommendation engine goal relevance', () => {
  it('uses the selected goal rate and suppresses an on-pace trend', () => {
    expect(types(generateRecommendationCandidates(baseFacts))).toContain(
      'goal_progress_behind_rate',
    );
    expect(
      types(
        generateRecommendationCandidates({
          ...baseFacts,
          weightTrendLbPerWeek: 0.5,
        }),
      ),
    ).not.toContain('goal_progress_behind_rate');
  });

  it('adds hydration only from recorded water days and keeps micronutrient relevance lowest', () => {
    const candidates = generateRecommendationCandidates({
      ...baseFacts,
      hydration: { averageMl: 900, recordedDays: 4, eligibleDays: 6 },
      micronutrients: [
        {
          nutrientKey: 'vitaminD',
          target: 15,
          average: 2,
          recordedDays: 4,
          eligibleDays: 6,
          coverage: 4 / 6,
          targetSource: 'reference',
          referenceVersion: 'health_canada_dri_2023',
        },
      ],
    });
    const hydration = candidates.find(
      (candidate) => candidate.type === 'hydration_below_target',
    );
    const micronutrient = candidates.find(
      (candidate) => candidate.type === 'micronutrient_below_target',
    );
    expect(hydration?.goalRelevanceScore).toBe(1);
    expect(micronutrient?.goalRelevanceScore).toBe(0);
  });

  it('does not generate micronutrient candidates in Simple mode', () => {
    const candidates = generateRecommendationCandidates({
      ...baseFacts,
      trackingMode: 'simple',
      micronutrients: [
        {
          nutrientKey: 'vitaminD',
          target: 15,
          average: 2,
          recordedDays: 4,
          eligibleDays: 4,
          coverage: 1,
          targetSource: 'reference',
          referenceVersion: 'health_canada_dri_2023',
        },
      ],
    });
    expect(types(candidates)).not.toContain('micronutrient_below_target');
  });

  it('does not flag calories when gain is already progressing at the selected rate', () => {
    const candidates = generateRecommendationCandidates({
      ...baseFacts,
      averageCalories: 1900,
      weightTrendLbPerWeek: 0.5,
    });
    expect(types(candidates)).not.toContain('calories_under_target');
  });
});

describe('recommendation lifecycle identity and ranking', () => {
  it('keeps fingerprints stable when only volatile source facts drift', () => {
    const candidate = {
      type: 'calories_under_target' as const,
      identityKey: 'calories_under_target',
      severity: 'medium' as const,
      goalRelevanceScore: 3 as const,
      rulePriority: 10,
      effectiveTargetSource: 'personalized',
      sourceFacts: { averageCalories: 1900, differenceCalories: 300 },
      title: 'Calories are below target',
      message: 'Logged calories are below target.',
    };
    expect(recommendationConditionFingerprint(candidate)).toBe(
      recommendationConditionFingerprint({
        ...candidate,
        sourceFacts: { averageCalories: 1850, differenceCalories: 350 },
      }),
    );
  });

  it('ranks by severity, confidence, relevance, priority, then identity', () => {
    const base = {
      type: 'protein_low' as const,
      identityKey: 'protein_low',
      sourceFacts: {
        confidenceScore: 80,
        goalRelevanceScore: 2,
        rulePriority: 20,
      },
    };
    const ordered = [
      { ...base, severity: 'low' as const, identityKey: 'z' },
      { ...base, severity: 'high' as const, identityKey: 'a' },
      { ...base, severity: 'medium' as const, identityKey: 'b' },
    ].sort(comparePersistedRecommendations);
    expect(ordered.map((item) => item.severity)).toEqual([
      'high',
      'medium',
      'low',
    ]);
  });
});
