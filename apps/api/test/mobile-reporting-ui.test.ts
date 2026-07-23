import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  availableValue,
  calorieAdherenceStatus,
  calorieHeroContext,
  calorieHeroTargetLabel,
  comparisonSentences,
  energyStatusLabel,
  nutrientDetailsForMode,
  nutrientKeysForMode,
  nutrientGroupLabel,
  nutrientPercentageAccessibilityLabel,
  nutrientPercentageLabel,
  nutrientPresentation,
  nutrientPresentationAccessibilityLabel,
  highlightedNutrientEntries,
  nutrientRowCopy,
  trackingModeLabel,
  previousPeriodNoDataLabel,
  proteinAdherenceStatus,
  reportWindowTitle,
  streakEntryLabel,
  streakHeadline,
  streakSupportingCopy,
  initialExpandedGroups,
  toggleExpandedGroup,
  weeklyMomentumDayFacts,
  weeklyMomentumDayState,
  weeklyMomentumFinalDay,
} from '../../mobile/src/lib/reporting-ui.js';
import {
  calendarDayAppearance,
  consumingCharcoalFraction,
  DAY_CELL_SIZE,
  DAY_RING_SIZE,
  DAY_RING_STROKE,
  isPreTrackingCalendar,
  semanticDayLabel,
  shiftMonth,
  STREAKS_ROUTE,
  type StreakCalendarDay,
} from '../../mobile/src/lib/streak-calendar-ui.js';
import * as streakCalendarUi from '../../mobile/src/lib/streak-calendar-ui.js';
import type { StreakCalendarResponse } from '@food-tracker/shared';

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

function calendarDay(overrides: Partial<StreakCalendarDay>): StreakCalendarDay {
  return {
    date: '2026-07-12',
    monthRelation: 'current',
    phase: 'past',
    logged: false,
    grace: false,
    missed: true,
    open: false,
    streakState: 'missed',
    calories: null,
    calorieRatio: null,
    calorieStatus: 'not_logged',
    goldDay: false,
    ...overrides,
  };
}

const preTrackingDay = calendarDay({ date: '2026-07-05' });
const openDay = calendarDay({
  date: '2026-07-20',
  phase: 'today',
  missed: false,
  open: true,
  streakState: 'open',
});
const futureDay = calendarDay({
  date: '2026-07-21',
  phase: 'future',
  missed: false,
  streakState: 'future',
});
const missedDay = calendarDay({ date: '2026-07-19' });
const loggedPartialDay = calendarDay({
  date: '2026-07-11',
  logged: true,
  missed: false,
  streakState: 'partial',
  calories: 1700,
  calorieRatio: 0.85,
  calorieStatus: 'below_range',
});
const loggedNoTargetDay = calendarDay({
  date: '2026-07-10',
  logged: true,
  missed: false,
  streakState: 'logged_without_target',
  calories: 2000,
  calorieStatus: 'no_target',
});
const goldDay = calendarDay({
  date: '2026-07-09',
  logged: true,
  missed: false,
  streakState: 'gold',
  calories: 2000,
  calorieRatio: 1,
  calorieStatus: 'within_range',
  goldDay: true,
});
const overTargetDay = calendarDay({
  date: '2026-07-08',
  logged: true,
  missed: false,
  streakState: 'over_target',
  calories: 2300,
  calorieRatio: 1.15,
  calorieStatus: 'over_range',
});
const graceDay = calendarDay({
  date: '2026-07-07',
  logged: true,
  grace: true,
  missed: false,
  streakState: 'grace',
  calories: 1900,
  calorieRatio: 0.95,
  calorieStatus: 'within_range',
});
const calendar: StreakCalendarResponse = {
  timezone: 'America/Toronto',
  requestedMonth: '2026-07',
  monthBoundary: { startDate: '2026-07-01', endDate: '2026-07-31' },
  displayBoundary: { startDate: '2026-06-28', endDate: '2026-08-01' },
  goalDirection: 'maintain',
  activeCalorieTarget: 2000,
  acceptedCalorieRange: {
    lowerRatio: 0.9,
    upperRatio: 1.1,
    lowerCalories: 1800,
    upperCalories: 2200,
  },
  currentStreak: {
    loggedDays: 1,
    spanDays: 1,
    longestLoggedDays: 1,
    graceUsed: false,
    graceDate: null,
    todayLogged: false,
    todayOpen: true,
  },
  weeks: [
    {
      startDate: '2026-07-05',
      endDate: '2026-07-11',
      goldWeek: false,
      days: [
        graceDay,
        overTargetDay,
        goldDay,
        loggedNoTargetDay,
        loggedPartialDay,
        preTrackingDay,
        missedDay,
      ],
    },
  ],
};

type DayDetailFacts = {
  fullDate: string;
  caloriesLogged: string;
  activeTarget: string;
  acceptedRange: string;
  status: string;
  targetDifference: string;
  loggedMeaning: string;
  goldMeaning: string;
  perfectWeekMeaning: string;
  graceExplanation: string | null;
};

type DayDetailFactsHelper = (
  day: StreakCalendarDay,
  activeCalorieTarget: number | null,
  acceptedCalorieRange: StreakCalendarResponse['acceptedCalorieRange'],
  goldWeek: boolean,
) => DayDetailFacts;

const dayDetailFacts = (
  streakCalendarUi as typeof streakCalendarUi & {
    dayDetailFacts?: DayDetailFactsHelper;
  }
).dayDetailFacts;

function detailsFor(day: StreakCalendarDay, goldWeek = false): DayDetailFacts {
  expect(dayDetailFacts).toBeTypeOf('function');

  if (dayDetailFacts === undefined) {
    throw new Error('dayDetailFacts is unavailable');
  }

  return dayDetailFacts(
    day,
    calendar.activeCalorieTarget,
    calendar.acceptedCalorieRange,
    goldWeek,
  );
}

describe('mobile reporting presentation helpers', () => {
  it('keeps the Progress streak action compact and singular-aware', () => {
    expect(streakEntryLabel(1)).toBe('1 day logged');
    expect(streakEntryLabel(7)).toBe('7 days logged');
  });

  it('keeps calorie hero context factual and complete', () => {
    expect(
      calorieHeroContext({
        caloriesConsumed: 2100,
        calorieTarget: 2000,
        caloriesRemaining: -100,
        acceptedCalorieRange: {
          lowerRatio: 0.9,
          upperRatio: 1.1,
          lowerCalories: 1800,
          upperCalories: 2200,
        },
      }),
    ).toEqual({
      amount: '2,100 kcal',
      range: '1,800–2,200 kcal accepted range',
      context: '100 kcal exceeded',
    });

    expect(
      calorieHeroContext({
        caloriesConsumed: 1200,
        calorieTarget: null,
        caloriesRemaining: null,
        acceptedCalorieRange: {
          lowerRatio: 0.9,
          upperRatio: 1.1,
          lowerCalories: 1800,
          upperCalories: 2200,
        },
      }),
    ).toEqual({ amount: '1,200 kcal', range: '—', context: '—' });
  });

  it('aligns nutrient percentages to returned target facts', () => {
    const proteinReport = {
      proteinTargetGrams: 130,
      proteinAdherence: {
        available: true as const,
        value: {
          averageAmount: 118,
          targetAmount: 130,
          percentage: 90,
          adherentDays: 3,
          loggedDays: 3,
        },
      },
    };
    const noTargetReport = {
      proteinTargetGrams: null,
      proteinAdherence: unavailable,
    };
    const noTargetNutrient = {
      displayName: 'Omega-3',
      category: 'fat_subtype' as const,
      total: 4.8,
      averagePerLoggedDay: 1.6,
      unit: 'g' as const,
      recordedDayCount: 3,
      goal: {
        value: null,
        unit: 'g' as const,
        direction: 'target' as const,
        source: 'missing' as const,
      },
      periodGoal: null,
      percentage: null,
    };

    expect(
      nutrientPercentageLabel({
        key: 'protein',
        average: 118,
        report: proteinReport,
      }),
    ).toBe('90%');
    expect(
      nutrientPercentageLabel({
        key: 'omega3',
        average: 1.6,
        report: noTargetReport,
      }),
    ).toBe('No goal set');
    expect(
      nutrientRowCopy({
        key: 'omega3',
        detail: noTargetNutrient,
        report: noTargetReport,
      }),
    ).not.toContain('target');
    expect(
      nutrientPercentageAccessibilityLabel({
        key: 'omega3',
        average: 1.6,
        report: noTargetReport,
      }),
    ).toBe('No goal set');
  });

  it('keeps recorded, target, unrecorded, setup, and zero nutrient states distinct', () => {
    const recordedProtein = {
      displayName: 'Protein',
      category: 'macro' as const,
      total: 0,
      averagePerLoggedDay: 0,
      unit: 'g' as const,
      recordedDayCount: 2,
      goal: {
        value: 100,
        unit: 'g' as const,
        direction: 'minimum' as const,
        source: 'user' as const,
      },
      periodGoal: 200,
      percentage: 0,
    };
    const recordedFiber = {
      displayName: 'Fiber',
      category: 'macro' as const,
      total: 40,
      averagePerLoggedDay: 20,
      unit: 'g' as const,
      recordedDayCount: 2,
      goal: {
        value: null,
        unit: 'g' as const,
        direction: 'target' as const,
        source: 'missing' as const,
      },
      periodGoal: null,
      percentage: null,
    };
    const proteinReport = {
      proteinTargetGrams: 100,
      proteinAdherence: {
        available: true as const,
        value: {
          averageAmount: 0,
          targetAmount: 100,
          percentage: 0,
          adherentDays: 0,
          loggedDays: 2,
        },
      },
    };

    expect(
      nutrientPresentation({
        key: 'protein',
        detail: recordedProtein,
        report: proteinReport,
      }),
    ).toMatchObject({
      state: 'recorded',
      totalLabel: '0 g',
      percentageLabel: '0%',
      goalMetadataLabel: 'Goal 200 g',
    });
    expect(
      nutrientPresentation({
        key: 'fiber',
        detail: recordedFiber,
        report: { proteinTargetGrams: null, proteinAdherence: unavailable },
      }),
    ).toMatchObject({
      state: 'setup_incomplete',
      statusLabel: 'Complete setup to see nutrient goal',
    });
    expect(
      nutrientPresentation({
        key: 'fiber',
        detail: null,
        report: { proteinTargetGrams: null, proteinAdherence: unavailable },
      }),
    ).toMatchObject({
      state: 'not_recorded',
      statusLabel: 'Not recorded in this period',
    });
    expect(
      nutrientPresentation({
        key: 'protein',
        detail: null,
        report: { proteinTargetGrams: null, proteinAdherence: unavailable },
        setupComplete: false,
      }),
    ).toMatchObject({
      state: 'setup_incomplete',
      statusLabel: 'Complete setup to see nutrient goal',
    });
  });

  it('renders every goal-backed nutrient percentage and truthful limit copy', () => {
    const report = {
      proteinTargetGrams: 100,
      proteinAdherence: unavailable,
      reportingGoals: {
        fiber: {
          value: 25,
          unit: 'g' as const,
          direction: 'minimum' as const,
          source: 'derived' as const,
        },
        sugar: {
          value: 50,
          unit: 'g' as const,
          direction: 'limit' as const,
          source: 'user' as const,
        },
        sodium: {
          value: 1000,
          unit: 'mg' as const,
          direction: 'limit' as const,
          source: 'user' as const,
        },
      },
    };

    expect(
      nutrientPresentation({
        key: 'fiber',
        detail: {
          displayName: 'Fiber',
          category: 'macro',
          total: 23,
          averagePerLoggedDay: 23,
          unit: 'g',
          recordedDayCount: 1,
          goal: report.reportingGoals.fiber,
          periodGoal: 25,
          percentage: 92,
        },
        report,
      }),
    ).toMatchObject({
      state: 'recorded',
      totalLabel: '23 g',
      percentageLabel: '92%',
      statusLabel: '92%',
      goalMetadataLabel: 'Goal 25 g',
    });

    expect(
      nutrientPresentation({
        key: 'sugar',
        detail: {
          displayName: 'Sugar',
          category: 'macro',
          total: 60,
          averagePerLoggedDay: 60,
          unit: 'g',
          recordedDayCount: 1,
          goal: report.reportingGoals.sugar,
          periodGoal: 50,
          percentage: 120,
        },
        report,
      }),
    ).toMatchObject({
      state: 'recorded',
      percentageLabel: '120%',
      statusLabel: '120%',
      goalMetadataLabel: 'Limit 50 g',
    });
    expect(
      nutrientPresentationAccessibilityLabel({
        displayName: 'Sugar',
        presentation: nutrientPresentation({
          key: 'sugar',
          detail: {
            displayName: 'Sugar',
            category: 'macro',
            total: 60,
            averagePerLoggedDay: 60,
            unit: 'g',
            recordedDayCount: 1,
            goal: report.reportingGoals.sugar,
            periodGoal: 50,
            percentage: 120,
          },
          report,
        }),
      }),
    ).toBe('Sugar, 60 g, 120 percent of a 50 g limit');

    expect(
      nutrientPresentation({
        key: 'sodium',
        detail: null,
        report,
      }),
    ).toMatchObject({
      state: 'not_recorded',
      statusLabel: 'Not recorded in this period',
    });
    expect(trackingModeLabel('simple')).toBe('Simple');
    expect(trackingModeLabel('complex')).toBe('Complex');
  });

  it('keeps highlighted nutrient cards present when a known nutrient was not recorded', () => {
    const entries = highlightedNutrientEntries({
      nutrientDetails: {
        fiber: {
          displayName: 'Fiber',
          category: 'macro',
          total: 0,
          averagePerLoggedDay: 0,
          unit: 'g',
          recordedDayCount: 1,
          goal: {
            value: 25,
            unit: 'g',
            direction: 'minimum',
            source: 'derived',
          },
          periodGoal: 25,
          percentage: 0,
        },
      },
    });

    expect(entries.map((entry) => entry.key)).toEqual([
      'fiber',
      'sugar',
      'sodium',
    ]);
    expect(entries.find((entry) => entry.key === 'sugar')?.detail).toBeNull();
    expect(entries.find((entry) => entry.key === 'sodium')?.detail).toBeNull();
  });

  it('keeps Insights reporting rows structurally consistent', async () => {
    const macroSource = await readFile(
      new URL(
        '../../mobile/src/components/macro-report-summary.tsx',
        import.meta.url,
      ),
      'utf8',
    );
    const highlightSource = await readFile(
      new URL(
        '../../mobile/src/components/highlighted-nutrient-summary.tsx',
        import.meta.url,
      ),
      'utf8',
    );
    const completeSource = await readFile(
      new URL(
        '../../mobile/src/components/complete-nutrient-report.tsx',
        import.meta.url,
      ),
      'utf8',
    );
    const insightsSource = await readFile(
      new URL(
        '../../mobile/src/components/insights-report-content.tsx',
        import.meta.url,
      ),
      'utf8',
    );

    expect(macroSource).toContain('macroEntries.map');
    expect(macroSource).toContain('detail?.percentage');
    expect(macroSource).toContain('goalMetadataLabel');
    expect(macroSource).toContain('colors.light.loggedProgress');
    expect(macroSource).not.toContain('showProteinRail');
    expect(macroSource).not.toContain('keyName ===');
    expect(highlightSource).toContain('goalMetadataLabel');
    expect(highlightSource).not.toContain('loggedProgress');
    expect(highlightSource).toContain('const small = width <= 340;');
    expect(completeSource).toContain('groupIndex === 0');
    expect(completeSource).toContain('border-t border-line');
    expect(completeSource).toContain('<View className="gap-3 pt-3">');
    expect(completeSource).toContain(
      '<View key={key} className="flex-row items-start gap-3">',
    );
    expect(completeSource).not.toContain('index === 0');
    expect(completeSource).not.toContain(
      "'flex-row items-start gap-3 border-t border-line py-3'",
    );
    expect(completeSource).not.toContain('loggedProgress');
    expect(insightsSource.match(/<MacroReportSummary/g)).toHaveLength(2);
  });

  it('keeps prior-period no-data copy compact and boundary-aware', () => {
    expect(
      previousPeriodNoDataLabel({
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      }),
    ).toBe('No logged data for Jun 1–Jun 30');
  });

  it('expands every visible Complex nutrient group independently', () => {
    expect(initialExpandedGroups(['general', 'vitamins'])).toEqual([
      'general',
      'vitamins',
    ]);
    expect(toggleExpandedGroup(['general', 'vitamins'], 'general')).toEqual([
      'vitamins',
    ]);
    expect(toggleExpandedGroup(['general', 'vitamins'], 'vitamins')).toEqual([
      'general',
    ]);
  });

  it('keeps Complex ledgers open by default without card or graph remnants', async () => {
    const source = await readFile(
      new URL(
        '../../mobile/src/components/complete-nutrient-report.tsx',
        import.meta.url,
      ),
      'utf8',
    );
    const contentSource = await readFile(
      new URL(
        '../../mobile/src/components/insights-report-content.tsx',
        import.meta.url,
      ),
      'utf8',
    );
    const insightsSource = await readFile(
      new URL('../../mobile/src/app/(tabs)/insights.tsx', import.meta.url),
      'utf8',
    );
    const dayRingSource = await readFile(
      new URL(
        '../../mobile/src/components/day-progress-ring.tsx',
        import.meta.url,
      ),
      'utf8',
    );
    const tokenSource = await readFile(
      new URL('../../mobile/src/theme/tokens.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain('Set<ReportingNutrientGroup>');
    expect(source).toContain('Expand all');
    expect(source).toContain('Collapse all');
    expect(source).toContain("import { AppCard } from './app-card';");
    expect(source).toContain('nutrientPresentation');
    expect(contentSource).not.toContain('DayStrip');
    expect(contentSource).toContain("import { AppCard } from './app-card';");
    expect(contentSource).not.toContain('bg-sage-dark');
    expect(insightsSource).not.toContain('@/components/empty-state');
    expect(insightsSource).not.toContain('◔');
    expect(dayRingSource).toContain(
      'progressColor={colors.light.loggedProgress}',
    );
    expect(tokenSource).toContain("loggedProgress: '#76DBA0'");
  });

  it('keeps user-facing mode labels on the Simple and Complex vocabulary', async () => {
    const sources = await Promise.all(
      [
        '../../mobile/src/app/onboarding.tsx',
        '../../mobile/src/components/onboarding-plan-preview.tsx',
        '../../mobile/src/app/(tabs)/profile.tsx',
        '../../mobile/src/app/(tabs)/progress.tsx',
      ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
    );

    for (const source of sources) {
      expect(source).not.toMatch(
        /Detailed tracking|Detailed mode|Start detailed/,
      );
      expect(source).not.toMatch(/['"]Detailed['"]/);
    }
  });

  it('keeps approved flame, laurel, and reporting artwork as shared SVG vectors', async () => {
    const flameSource = await readFile(
      new URL('../../mobile/src/components/streak-flame.tsx', import.meta.url),
      'utf8',
    );
    const laurelSource = await readFile(
      new URL(
        '../../mobile/src/components/grace-laurel-icon.tsx',
        import.meta.url,
      ),
      'utf8',
    );
    const iconSource = await readFile(
      new URL(
        '../../mobile/src/components/reporting-icon.tsx',
        import.meta.url,
      ),
      'utf8',
    );

    expect(flameSource).toContain("from 'react-native-svg'");
    expect(flameSource).toContain('fill="#EA1226"');
    expect(flameSource).not.toContain('.png');
    expect(laurelSource).toContain('fill="#171717"');
    expect(laurelSource).not.toContain('<Circle');
    expect(laurelSource).not.toContain('.png');
    expect(iconSource).toContain("from 'react-native-svg'");
    expect(iconSource).toContain("'energy'");
    expect(iconSource).toContain("'macros'");
    expect(iconSource).toContain("'nutrients'");
    expect(iconSource).toContain("'compare'");
    expect(iconSource).not.toContain('lucide');
  });

  it('keeps elapsed comparison graph-free and visibly separate from the full period', async () => {
    const source = await readFile(
      new URL(
        '../../mobile/src/components/equivalent-period-comparison.tsx',
        import.meta.url,
      ),
      'utf8',
    );

    expect(source).not.toContain('GitCompareArrows');
    expect(source).not.toContain('h-2 w-2');
    expect(source).toContain('Period comparison');
    expect(source).toContain('equivalent elapsed period');
  });

  it('preserves recommendation metadata, dismissal wording, and flat reports', async () => {
    const source = await readFile(
      new URL('../../mobile/src/app/(tabs)/insights.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('High priority');
    expect(source).toContain('Dismiss recommendation: ${recommendation.title}');
    expect(source).toContain('No recommendations right now');
    expect(source).toContain('Refresh');
    expect(source).not.toContain('RadialProgressRing');
  });

  it('uses an em dash for unavailable calorie targets', () => {
    expect(calorieHeroTargetLabel(null)).toBe('—');
    expect(calorieHeroTargetLabel(0)).toBe('—');
    expect(calorieHeroTargetLabel(2000)).toBe('2,000 kcal target');
  });

  it('passes through only returned weekly day facts', () => {
    const days = [
      { date: '2026-07-20', logged: true, calories: 2000, proteinGrams: 120 },
      { date: '2026-07-21', logged: false, calories: 0, proteinGrams: 0 },
    ];

    expect(weeklyMomentumDayFacts({ dailyBreakdown: days })).toEqual(days);
    expect(weeklyMomentumDayFacts({ dailyBreakdown: [] })).toEqual([]);
  });

  it('uses the final returned day for compact weekly momentum state', () => {
    const days = [
      { date: '2026-07-20', logged: true, calories: 2000, proteinGrams: 120 },
      { date: '2026-07-21', logged: false, calories: 0, proteinGrams: 0 },
    ];

    expect(weeklyMomentumFinalDay({ dailyBreakdown: days })).toEqual(days[1]);
    expect(weeklyMomentumFinalDay({ dailyBreakdown: [] })).toBeNull();
    const finalDay = days.at(-1);
    expect(finalDay).toBeDefined();
    if (finalDay === undefined) return;
    expect(weeklyMomentumDayState(finalDay)).toEqual({
      status: 'Not logged',
      calories: '0 kcal',
      protein: '0 g',
    });
  });

  it('derives complete in-range details for a selected gold day', () => {
    expect(detailsFor(goldDay, true)).toEqual({
      fullDate: 'Thursday, July 9, 2026',
      caloriesLogged: '2,000 kcal',
      activeTarget: '2,000 kcal',
      acceptedRange: '1,800–2,200 kcal',
      status: 'Within target range',
      targetDifference: 'On target',
      loggedMeaning: 'Counts as a logged day.',
      goldMeaning: 'Counts as a gold day.',
      perfectWeekMeaning: 'Contributes to this perfect week.',
      graceExplanation: null,
    });
  });

  it('uses calendar-specific unavailable and state copy without report fallbacks', () => {
    const noTargetDetails = dayDetailFacts?.(
      loggedNoTargetDay,
      null,
      null,
      false,
    );
    expect(noTargetDetails).toMatchObject({
      caloriesLogged: '2,000 kcal',
      activeTarget: '—',
      acceptedRange: '—',
      status: 'Target not set',
      targetDifference: '—',
      loggedMeaning: 'Counts as a logged day.',
      goldMeaning: 'Not a gold day because no target is set.',
      perfectWeekMeaning: 'Does not contribute to a perfect week.',
    });

    expect(detailsFor(loggedPartialDay)).toMatchObject({
      status: 'Below target range',
      targetDifference: '300 kcal remaining to target',
    });
    expect(detailsFor(overTargetDay)).toMatchObject({
      status: 'Above target range',
      targetDifference: '300 kcal above target',
    });
    expect(detailsFor(openDay)).toMatchObject({
      caloriesLogged: '—',
      targetDifference: '—',
      status: 'Open for logging',
      loggedMeaning: 'Today remains non-breaking until the local day ends.',
    });
    expect(detailsFor(futureDay)).toMatchObject({
      caloriesLogged: '—',
      status: 'Future day',
      loggedMeaning: 'Future dates are excluded from streak evaluation.',
    });
    expect(detailsFor(missedDay)).toMatchObject({
      caloriesLogged: '—',
      status: 'Missed day',
      loggedMeaning: 'Breaks logging continuity.',
    });

    for (const details of [
      noTargetDetails,
      detailsFor(openDay),
      detailsFor(futureDay),
      detailsFor(missedDay),
    ]) {
      expect(Object.values(details ?? {}).join(' ')).not.toMatch(
        /previous|no data/i,
      );
    }
  });

  it('keeps grace span and perfect-week contribution separate from logging counts', () => {
    expect(detailsFor(graceDay)).toMatchObject({
      status: 'Grace day',
      loggedMeaning: 'Preserves the streak span without adding a logged day.',
      goldMeaning: 'Grace days are never gold.',
      perfectWeekMeaning: 'Does not contribute to a perfect week.',
      graceExplanation:
        'A grace day bridges one missed day in the streak span.',
    });
  });

  it('uses the split hero flame and opens details from calendar day presses', async () => {
    const source = await readFile(
      new URL('../../mobile/src/app/streaks.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain(
      "import { StreakFlame } from '@/components/streak-flame';",
    );
    expect(source).toContain('<StreakFlame size={78} />');
    expect(source).toMatch(
      /<MonthlyStreakCalendar\s+calendar=\{calendar\}\s+onDayPress=\{setSelectedDay\}/,
    );
    expect(source).toContain('<StreakDayDetailSheet');
    expect(source).not.toMatch(/\bFlame\b/);
  });

  it('keeps calendar dates non-pressable when no day handler is supplied', async () => {
    const source = await readFile(
      new URL(
        '../../mobile/src/components/monthly-streak-calendar.tsx',
        import.meta.url,
      ),
      'utf8',
    );

    expect(source.match(/if \(onDayPress === undefined\)/g)).toHaveLength(2);
    expect(
      source.match(
        /accessible\s+accessibilityLabel=\{semanticDayLabel\(day\)\}/g,
      ),
    ).toHaveLength(2);
    expect(source.match(/accessibilityRole="button"/g)).toHaveLength(2);
    expect(source.match(/onPress=\{\(\) => onDayPress\(day\)\}/g)).toHaveLength(
      2,
    );
  });

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
          goal: {
            value: 25,
            unit: 'g' as const,
            direction: 'minimum' as const,
            source: 'derived' as const,
          },
          periodGoal: 50,
          percentage: 80,
        },
        vitaminC: {
          displayName: 'Vitamin C',
          category: 'vitamin' as const,
          total: 80,
          averagePerLoggedDay: 40,
          unit: 'mg' as const,
          recordedDayCount: 2,
          goal: {
            value: 90,
            unit: 'mg' as const,
            direction: 'minimum' as const,
            source: 'default' as const,
          },
          periodGoal: 180,
          percentage: 44.4,
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

  it('maps calendar facts to the shared visual families without losing semantics', () => {
    expect(DAY_CELL_SIZE).toBe(44);
    expect(DAY_RING_SIZE).toBe(34);
    expect(DAY_RING_STROKE).toBe(3);
    expect(calendarDayAppearance(preTrackingDay, true).visual).toBe('plain');
    expect(calendarDayAppearance(openDay).visual).toBe('dotted');
    expect(calendarDayAppearance(futureDay).visual).toBe('dotted');
    expect(calendarDayAppearance(missedDay).visual).toBe('dotted');
    expect(calendarDayAppearance(loggedPartialDay).visual).toBe(
      'green-progress',
    );
    expect(calendarDayAppearance(loggedNoTargetDay).visual).toBe(
      'green-complete',
    );
    expect(calendarDayAppearance(goldDay).visual).toBe('gold');
    expect(calendarDayAppearance(overTargetDay).visual).toBe('over-target');
    expect(calendarDayAppearance(graceDay).visual).toBe('grace');
    expect(
      isPreTrackingCalendar({
        ...calendar,
        currentStreak: { ...calendar.currentStreak, longestLoggedDays: 0 },
      }),
    ).toBe(true);
    expect(
      isPreTrackingCalendar({
        ...calendar,
        currentStreak: { ...calendar.currentStreak, longestLoggedDays: 1 },
      }),
    ).toBe(false);

    expect(semanticDayLabel(openDay)).toContain('open for logging');
    expect(semanticDayLabel(futureDay)).toContain('excluded from streak');
    expect(semanticDayLabel(missedDay)).toContain('missed;');
    expect(semanticDayLabel(graceDay)).toContain('grace day;');
    expect(semanticDayLabel(goldDay)).toContain('gold, inside');
    expect(semanticDayLabel(loggedNoTargetDay)).toContain(
      'logged without a calorie target',
    );
    expect(semanticDayLabel(loggedPartialDay)).toContain('partial, below');
    expect(semanticDayLabel(overTargetDay)).toContain('over target, above');
  });
});
