import type { AnalyticsReportOverviewState } from '@/lib/analytics/analytics-report-resource';
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
});
