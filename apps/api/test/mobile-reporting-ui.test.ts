import { describe, expect, it } from 'vitest';
import {
  availableValue,
  calorieAdherenceStatus,
  comparisonSentences,
  energyStatusLabel,
  nutrientDetailsForMode,
  nutrientKeysForMode,
  nutrientGroupLabel,
  proteinAdherenceStatus,
  reportWindowTitle,
  streakHeadline,
  streakSupportingCopy,
} from '../../mobile/src/lib/reporting-ui.js';
import {
  consumingCharcoalFraction,
  semanticDayLabel,
  shiftMonth,
  STREAKS_ROUTE,
} from '../../mobile/src/lib/streak-calendar-ui.js';

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

  it('keeps reporting presentation scoped to recorded nutrient details', () => {
    const report = {
      nutrientDetails: {
        fiber: {
          displayName: 'Fiber',
          category: 'macro' as const,
          total: 40,
          averagePerLoggedDay: 20,
          unit: 'g' as const,
          recordedDayCount: 2,
        },
        vitaminC: {
          displayName: 'Vitamin C',
          category: 'vitamin' as const,
          total: 80,
          averagePerLoggedDay: 40,
          unit: 'mg' as const,
          recordedDayCount: 2,
        },
      },
    };

    expect(
      nutrientDetailsForMode(report, 'simple').map((entry) => entry.key),
    ).toEqual(['fiber']);
    expect(
      nutrientDetailsForMode(report, 'complex').map((entry) => entry.key),
    ).toEqual(['fiber', 'vitaminC']);
    expect(nutrientGroupLabel('protein_amino_acid')).toBe(
      'Protein and amino acids',
    );
  });

  it('labels energy states without exposing backend reason codes', () => {
    expect(energyStatusLabel('no_data')).toBe('No logged energy yet');
    expect(energyStatusLabel('no_target')).toBe('Target not set');
    expect(energyStatusLabel('below_range')).toBe('Below target range');
    expect(energyStatusLabel('within_range')).toBe('Within target range');
    expect(energyStatusLabel('over_range')).toBe('Above target range');
  });

  it('names current and full-period report windows separately', () => {
    expect(
      reportWindowTitle('week', 'current', {
        startDate: '2026-07-12',
        endDate: '2026-07-18',
        elapsedThroughDate: '2026-07-15',
      }),
    ).toBe('Current week so far · Jul 12 – Jul 15');
    expect(
      reportWindowTitle('week', 'previous', {
        startDate: '2026-07-05',
        endDate: '2026-07-11',
        elapsedThroughDate: '2026-07-11',
      }),
    ).toBe('Previous full week · Jul 5 – Jul 11');
  });

  it('consumes the former gold ring with charcoal above the backend upper ratio', () => {
    expect(consumingCharcoalFraction(1.1, 1.05)).toBeCloseTo(0.25);
    expect(consumingCharcoalFraction(1.2, 1.05)).toBeCloseTo(0.75);
    expect(consumingCharcoalFraction(1.25, 1.05)).toBe(1);
    expect(consumingCharcoalFraction(1.5, 1.05)).toBe(1);
    expect(consumingCharcoalFraction(-1, 1.05)).toBe(0);
  });

  it('uses semantic day labels and the nested streak route', () => {
    expect(STREAKS_ROUTE).toBe('/streaks');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(
      semanticDayLabel({
        date: '2026-07-18',
        monthRelation: 'current',
        phase: 'past',
        logged: true,
        grace: false,
        missed: false,
        open: false,
        streakState: 'over_target',
        calories: 2300,
        calorieRatio: 1.15,
        calorieStatus: 'over_range',
        goldDay: false,
      }),
    ).toContain('over target');
    expect(
      semanticDayLabel({
        date: '2026-07-20',
        monthRelation: 'current',
        phase: 'today',
        logged: false,
        grace: false,
        missed: false,
        open: true,
        streakState: 'open',
        calories: null,
        calorieRatio: null,
        calorieStatus: 'not_logged',
        goldDay: false,
      }),
    ).toContain('non-breaking until the local day ends');
    expect(
      semanticDayLabel({
        date: '2026-07-21',
        monthRelation: 'current',
        phase: 'future',
        logged: false,
        grace: false,
        missed: false,
        open: false,
        streakState: 'future',
        calories: null,
        calorieRatio: null,
        calorieStatus: 'not_logged',
        goldDay: false,
      }),
    ).toContain('excluded from streak evaluation');
  });
});
