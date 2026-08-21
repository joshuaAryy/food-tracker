import type { CanonicalTrendResponse } from '@food-tracker/shared';
import type {
  AnalyticsReportOverviewState,
  AnalyticsReportSectionState,
} from '@/lib/analytics/analytics-report-resource';
import { simpleInsightsFixture } from '@/test-fixtures/analytics-fixtures';
import { render } from '@/test/render';
import { MacroBalanceCard } from '../macro-balance-card';

const macroOverview = {
  data: {
    protein: { grams: 149, percentage: 24 },
    carbs: { grams: 269, percentage: 49 },
    fat: { grams: 49, percentage: 27 },
    status: 'recorded',
  },
  fetchedAt: '2026-08-18T12:00:00.000Z',
  status: 'available',
  error: null,
  retryable: false,
} satisfies AnalyticsReportOverviewState<'macros'>;

function availableSection(
  data: CanonicalTrendResponse,
): AnalyticsReportSectionState {
  return {
    data,
    fetchedAt: '2026-08-18T12:00:00.000Z',
    status: 'available',
    error: null,
    retryable: false,
  };
}

describe('MacroBalanceCard', () => {
  it('keeps the compact overview composition at the Figma card height', async () => {
    const screen = await render(
      <MacroBalanceCard
        overview={macroOverview}
        energyAverage={2184}
        proteinTrend={undefined}
        onOpenTrend={jest.fn()}
        onRetry={jest.fn()}
        compact
      />,
    );

    expect(screen.getByTestId('macro-balance-card').props.style).toEqual(
      expect.objectContaining({ minHeight: 236 }),
    );
    expect(screen.getByText('2,184')).toBeTruthy();
    expect(screen.queryByText('2,184.0')).toBeNull();
  });

  it('uses protein daily observations when the optional rolling layer has no values', async () => {
    const screen = await render(
      <MacroBalanceCard
        overview={macroOverview}
        energyAverage={2184}
        proteinTrend={availableSection({
          ...simpleInsightsFixture.sections.protein,
          rollingTrend: {
            window: 14,
            values: simpleInsightsFixture.sections.protein.points.map(
              () => null,
            ),
          },
        })}
        onOpenTrend={jest.fn()}
        onRetry={jest.fn()}
        presentation="complex"
      />,
    );

    const preview = screen.getByLabelText('Protein trend');
    expect(JSON.stringify(preview)).toContain('"strokeWidth":3');
    expect(JSON.stringify(preview)).toContain('"bbHeight":64');
  });

  it('replaces the protein trend label with an unavailable state when no facts exist', async () => {
    const protein = simpleInsightsFixture.sections.protein;
    const screen = await render(
      <MacroBalanceCard
        overview={macroOverview}
        energyAverage={2184}
        proteinTrend={availableSection({
          ...protein,
          points: protein.points.map((point) => ({ ...point, value: null })),
          rollingTrend: {
            window: 14,
            values: protein.points.map(() => null),
          },
        })}
        onOpenTrend={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText('Protein trend unavailable')).toBeTruthy();
    expect(screen.queryByText('TREND · Protein')).toBeNull();
    expect(screen.queryByLabelText('Protein trend')).toBeNull();
  });
});
