import type { CanonicalInsightsResponse } from '@food-tracker/shared';
import {
  analyticsFixtureLayouts,
  activeScrubTrendFixture,
  caloriesTrendFixture,
  complexInsightsFixture,
  firstUseCaloriesTrendFixture,
  firstUseProteinTrendFixture,
  longSavedViewFixture,
  sparseVitaminDTrendFixture,
  waterLogFixtures,
} from './analytics-fixtures';

const committedReport: CanonicalInsightsResponse = complexInsightsFixture;

export const analyticsStateFixtures = {
  layouts: analyticsFixtureLayouts,
  simpleCapabilities: {
    supportsCustomRange: false,
    supportsSavedViews: false,
    supportsTwoMetricComparison: false,
    supportsFullNutrientLibrary: false,
  },
  complexCapabilities: {
    supportsCustomRange: true,
    supportsSavedViews: true,
    supportsTwoMetricComparison: true,
    supportsFullNutrientLibrary: true,
  },
  loading: { nodeId: '477:21', report: null },
  refreshPending: {
    nodeId: '510:437',
    report: committedReport,
    refreshing: true,
  },
  staleCached: {
    nodeId: '510:467',
    report: committedReport,
    cachedAt: '2026-08-05T12:00:00.000Z',
    refreshError: 'Couldn’t refresh',
  },
  firstUse: {
    nodeId: '495:21',
    today: {
      mealCount: 1,
      calories: 612,
      proteinGrams: 38,
    },
    unlock: { loggedDays: 2, requiredDays: 7 },
    report: {
      mode: 'simple',
      period: 'week',
      sections: {
        calories: firstUseCaloriesTrendFixture,
        protein: firstUseProteinTrendFixture,
      },
    } satisfies CanonicalInsightsResponse,
  },
  currentPeriodInProgress: {
    nodeId: '492:455',
    report: committedReport,
    currentDate: '2026-08-05',
  },
  sectionFailure: {
    nodeId: '492:753',
    report: committedReport,
    failedSections: ['weight'] as const,
  },
  fullUnavailable: { nodeId: '477:141', report: null, retryable: true },
  forecastUnavailable: {
    nodeId: '492:1058',
    trend: caloriesTrendFixture,
  },
  activeScrub: {
    nodeId: '492:1097',
    trend: activeScrubTrendFixture,
    selectedDate: '2026-07-29',
    selectedValue: 2490,
  },
  offlineCached: {
    nodeId: '492:1279',
    report: committedReport,
    cachedAt: '2026-08-05T12:00:00.000Z',
  },
  sparseVitaminD: sparseVitaminDTrendFixture,
  savedView: longSavedViewFixture,
  waterLogs: waterLogFixtures,
} as const;
