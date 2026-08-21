import type {
  AnalyticsPreferenceValue,
  AnalyticsSavedView,
  Recommendation,
} from '@food-tracker/shared';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        apiUrl: 'https://food-tracker.test/api/v1',
        appEnvironment: 'development',
      },
    },
  },
}));

import { api } from '@/lib/api-client';
import type { AnalyticsReportOverviewState } from '@/lib/analytics/analytics-report-resource';
import { render, userEvent } from '@/test/render';
import { InsightsTabs } from '../insights-tabs';
import { PinnedAnalysisCard } from '../pinned-analysis-card';
import { ComplexInsightsNutrients } from '../complex-insights-nutrients';
import { RecommendationsCard } from '../recommendations-card';

const preferences: AnalyticsPreferenceValue = {
  preferredSimpleMetric: 'calories',
  pinnedSavedViewId: 'saved-view-1',
};

const views: AnalyticsSavedView[] = [
  {
    id: 'saved-view-1',
    name: 'Protein · 30D',
    primaryMetric: 'protein',
    comparisonMetric: null,
    periodDays: 30,
    aggregation: 'automatic',
    visualization: 'automatic',
    showReference: true,
    coverageFilter: 'all_logged_days',
    sortOrder: 0,
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
    unavailableMetrics: [],
  },
];

const nutrientOverview: AnalyticsReportOverviewState<'nutrientHighlights'> = {
  status: 'available',
  fetchedAt: '2026-08-11T12:00:00.000Z',
  error: null,
  retryable: false,
  data: {
    highlights: [
      {
        metric: 'fiber',
        value: 28,
        unit: 'g',
        availability: 'recorded',
        reference: { kind: 'minimum', value: 30, unit: 'g', source: 'derived' },
        status: 'below_minimum',
      },
      {
        metric: 'sodium',
        value: 1800,
        unit: 'mg',
        availability: 'recorded',
        reference: {
          kind: 'limit',
          value: 2300,
          unit: 'mg',
          source: 'default',
        },
        status: 'within_limit',
      },
      {
        metric: 'vitaminC',
        value: null,
        unit: 'mg',
        availability: 'unknown',
        reference: { kind: 'none', unit: 'mg', reason: 'not_configured' },
        status: 'unknown',
      },
    ],
  },
};

const recommendation = {
  id: 'recommendation-1',
  type: 'protein_low',
  severity: 'medium',
  status: 'active',
  title: 'Add a protein-rich snack',
  message: 'A snack can help close the gap.',
  sourceFacts: { averageProteinGrams: 80 },
  createdAt: '2026-08-11T12:00:00.000Z',
} as Recommendation;

describe('Complex Insights presentation boundaries', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes the approved Overview, Nutrients, and Recommendations tabs', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <InsightsTabs value="overview" onChange={onChange} />,
    );

    expect(screen.getByRole('tab', { name: 'Overview' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Nutrients' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Recommendations' })).toBeTruthy();

    await userEvent
      .setup()
      .press(screen.getByRole('tab', { name: 'Nutrients' }));
    expect(onChange).toHaveBeenCalledWith('nutrients');
  });

  it('renders the pinned analysis as a compact primary-view entrypoint with Manage', async () => {
    jest.spyOn(api.analytics, 'trend').mockResolvedValue({
      timezone: 'America/New_York',
      trackingMode: 'complex',
      primaryMetric: 'protein',
      aggregation: 'daily',
      resolvedRange: { startDate: '2026-08-01', endDate: '2026-08-30' },
      firstEligibleDate: null,
      today: '2026-08-30',
      reference: { kind: 'none', unit: 'g', reason: 'not_configured' },
      interpretation: null,
      relatedMetrics: [],
      points: [],
      summary: { numericDayCount: 0, average: null },
    });
    const onManage = jest.fn();
    const onOpen = jest.fn();
    const screen = await render(
      <PinnedAnalysisCard
        preferences={preferences}
        views={views}
        onManage={onManage}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByText('Pinned analysis')).toBeTruthy();
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Manage pinned analysis' }));
    expect(onManage).toHaveBeenCalledTimes(1);
    await userEvent
      .setup()
      .press(
        screen.getByRole('button', { name: 'Open pinned view: Protein · 30D' }),
      );
    expect(onOpen).toHaveBeenCalledWith('protein', expect.any(String));
  });

  it('keeps nutrient reference states on the section-aware boundary and routes to the library', async () => {
    const onExplore = jest.fn();
    const onRetry = jest.fn();
    const screen = await render(
      <ComplexInsightsNutrients
        report={null}
        overview={nutrientOverview}
        loading={false}
        error={null}
        onRetry={onRetry}
        onOverviewRetry={onRetry}
        onExploreTrends={onExplore}
      />,
    );

    expect(screen.getByText('Reference semantics')).toBeTruthy();
    expect(
      screen.getByText('True range · both authoritative bounds are present'),
    ).toBeTruthy();
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Explore nutrient trends' }));
    expect(onExplore).toHaveBeenCalledTimes(1);
  });

  it('renders recommendation history only from the supplied canonical collection', async () => {
    const screen = await render(
      <RecommendationsCard
        recommendations={[recommendation]}
        dismissedRecommendations={[
          { ...recommendation, id: 'dismissed-1', status: 'dismissed' },
        ]}
        error={null}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByText('Dismissed and completed')).toBeTruthy();
    expect(screen.getAllByText('Add a protein-rich snack')).toHaveLength(2);
  });
});
