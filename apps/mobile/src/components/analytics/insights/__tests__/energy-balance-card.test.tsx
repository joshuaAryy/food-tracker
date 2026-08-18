import type { CanonicalTrendResponse } from '@food-tracker/shared';
import type {
  AnalyticsReportOverviewState,
  AnalyticsReportSectionState,
} from '@/lib/analytics/analytics-report-resource';
import { caloriesTrendFixture } from '@/test-fixtures/analytics-fixtures';
import { render } from '@/test/render';
import { EnergyBalanceCard } from '../energy-balance-card';

const energyOverview = {
  data: {
    average: 1846,
    numericDayCount: 24,
    reference: {
      kind: 'range',
      lower: 1700,
      upper: 2300,
      unit: 'kcal',
      source: 'derived',
    },
    withinRangeDayCount: 20,
    comparison: { direction: 'up', percentage: 3 },
    status: 'within_range',
  },
  fetchedAt: '2026-08-18T12:00:00.000Z',
  status: 'available',
  error: null,
  retryable: false,
} satisfies AnalyticsReportOverviewState<'energy'>;

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

describe('EnergyBalanceCard', () => {
  it('uses daily observations when the optional rolling layer has no values', async () => {
    const screen = await render(
      <EnergyBalanceCard
        overview={energyOverview}
        trend={availableSection({
          ...caloriesTrendFixture,
          rollingTrend: {
            window: 14,
            values: caloriesTrendFixture.points.map(() => null),
          },
        })}
        onOpenTrend={jest.fn()}
        onRetry={jest.fn()}
        presentation="complex"
      />,
    );

    const preview = screen.getByLabelText('Energy balance trend');
    expect(JSON.stringify(preview)).toContain('"strokeWidth":3');
    expect(screen.getByText('14 days')).toBeTruthy();
    expect(screen.queryByText('14D')).toBeNull();
  });

  it('states that the preview is unavailable when neither daily nor rolling facts exist', async () => {
    const screen = await render(
      <EnergyBalanceCard
        overview={energyOverview}
        trend={availableSection({
          ...caloriesTrendFixture,
          points: caloriesTrendFixture.points.map((point) => ({
            ...point,
            value: null,
          })),
          rollingTrend: {
            window: 14,
            values: caloriesTrendFixture.points.map(() => null),
          },
        })}
        onOpenTrend={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText('Energy trend unavailable')).toBeTruthy();
    expect(screen.queryByLabelText('Energy balance trend')).toBeNull();
  });
});
