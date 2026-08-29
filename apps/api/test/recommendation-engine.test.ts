import { describe, expect, it } from 'vitest';
import {
  generateRecommendationCandidates,
  type RecommendationCandidate,
} from '../src/modules/recommendations/engine.js';
import type { RecommendationAnalyticsFacts } from '../src/modules/analytics/recommendation-facts.js';

const baseFacts: RecommendationAnalyticsFacts = {
  timezone: 'America/Toronto',
  currentLocalDate: '2026-08-29',
  daysAnalyzed: 7,
  targetCalories: 2200,
  targetProteinGrams: 140,
  goalType: 'gain',
  targetWeightLb: 180,
  targetRateLbPerWeek: 0.5,
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
});
