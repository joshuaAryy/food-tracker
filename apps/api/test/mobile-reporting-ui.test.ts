import { describe, expect, it } from 'vitest';
import {
  availableValue,
  calorieAdherenceStatus,
  comparisonSentences,
  nutrientKeysForMode,
  proteinAdherenceStatus,
  streakHeadline,
  streakSupportingCopy,
} from '../../mobile/src/lib/reporting-ui.js';

const unavailable = {
  available: false as const,
  reason: 'minimum_logged_days' as const,
};
const available = {
  available: true as const,
  value: {
    averageAmount: 2000,
    targetAmount: 2000,
    percentage: 100,
    adherentDays: 3,
    loggedDays: 3,
  },
};

describe('mobile reporting presentation helpers', () => {
  it('hides unavailable metrics without exposing technical availability wording', () => {
    expect(availableValue(unavailable)).toBeNull();
    expect(String(availableValue(unavailable))).not.toContain(
      'minimum_logged_days',
    );
  });

  it('keeps the grace day out of the streak headline while explaining the span', () => {
    expect(streakHeadline(4)).toBe('4-day streak');
    expect(
      streakSupportingCopy({
        loggedDays: 4,
        spanDays: 5,
        longestLoggedDays: 4,
        graceUsed: true,
        graceDate: '2026-07-12',
        todayLogged: false,
        todayOpen: true,
      }),
    ).toBe('4 days logged across 5 days.');
  });

  it('maps goal-direction ranges and protein independently', () => {
    expect(
      calorieAdherenceStatus(
        { ...available, value: { ...available.value, percentage: 89 } },
        'maintain',
      ),
    ).toBe('Below target range');
    expect(calorieAdherenceStatus(available, 'gain')).toBe(
      'Within target range',
    );
    expect(
      proteinAdherenceStatus({
        ...available,
        value: { ...available.value, percentage: 89 },
      }),
    ).toBe('Below target');
    expect(proteinAdherenceStatus(available)).toBe('On target');
  });

  it('keeps Simple nutrient scope focused and comparisons factual', () => {
    expect(nutrientKeysForMode('simple')).toEqual(['fiber', 'sugar', 'sodium']);
    expect(nutrientKeysForMode('complex')).toEqual([]);
    expect(
      comparisonSentences({
        currentBoundary: { startDate: '2026-07-12', endDate: '2026-07-15' },
        previousEquivalentBoundary: {
          startDate: '2026-07-05',
          endDate: '2026-07-08',
        },
        loggedDays: { current: 3, previous: 1, delta: 2 },
      }),
    ).toEqual(['Logged 2 days more.']);
  });
});
