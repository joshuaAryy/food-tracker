import { render, userEvent } from '@/test/render';
import { HydrationInsightsCard } from '../hydration-insights-card';

describe('HydrationInsightsCard', () => {
  it('uses the compact Figma vessel and action composition', async () => {
    const onLogWater = jest.fn();
    const screen = await render(
      <HydrationInsightsCard
        overview={{
          status: 'available',
          fetchedAt: '2026-08-18T12:00:00.000Z',
          error: null,
          retryable: false,
          data: {
            today: '2026-08-18',
            timezone: 'America/Toronto',
            total: 1630,
            goal: 2000,
            status: 'below_goal',
            trendSection: 'hydration',
          },
        }}
        trend={undefined}
        onLogWater={onLogWater}
        onOpenTrend={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getAllByTestId(/hydration-vessel-\d+$/)).toHaveLength(8);
    expect(
      screen.getByTestId('hydration-vessel-row').props.className,
    ).toContain('gap-[15px]');
    expect(
      screen.getByTestId('hydration-vessel-row').props.className,
    ).not.toContain('justify-between');
    expect(screen.getByTestId('hydration-insights-actions')).toBeTruthy();
    expect(screen.getByTestId('hydration-quick-add').props.className).toContain(
      'min-h-8',
    );
    expect(
      screen.getByTestId('hydration-other-amount').props.className,
    ).toContain('bg-water-soft');
    expect(screen.getByText('Other amount ›').props.numberOfLines).toBe(1);

    const user = userEvent.setup();
    await user.press(screen.getByTestId('hydration-other-amount'));
    await user.press(screen.getByTestId('hydration-quick-add'));
    expect(onLogWater).toHaveBeenCalledTimes(2);
  });

  it('distinguishes no water today from no hydration history', async () => {
    const baseOverview = {
      status: 'available' as const,
      fetchedAt: '2026-08-18T12:00:00.000Z',
      error: null,
      retryable: false,
      data: {
        today: '2026-08-18',
        timezone: 'America/Toronto',
        total: null,
        goal: 2000,
        status: 'unknown' as const,
        trendSection: 'hydration' as const,
      },
    };
    const screen = await render(
      <HydrationInsightsCard
        overview={baseOverview}
        trend={{
          status: 'available',
          fetchedAt: '2026-08-18T12:00:00.000Z',
          error: null,
          retryable: false,
          data: {
            primaryMetric: 'hydration',
            summary: { numericDayCount: 3, average: 1500 },
          } as never,
        }}
        onLogWater={jest.fn()}
        onOpenTrend={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText('No water logged today')).toBeTruthy();
    expect(screen.queryByText('Water data unavailable')).toBeNull();

    const historyScreen = await render(
      <HydrationInsightsCard
        overview={baseOverview}
        trend={undefined}
        onLogWater={jest.fn()}
        onOpenTrend={jest.fn()}
        onRetry={jest.fn()}
      />,
    );
    expect(historyScreen.getByText('No hydration history yet')).toBeTruthy();
  });

  it('uses the isolated error state for a hydration request failure', async () => {
    const screen = await render(
      <HydrationInsightsCard
        overview={undefined}
        trend={undefined}
        onLogWater={jest.fn()}
        onOpenTrend={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText('Hydration couldn’t load')).toBeTruthy();
    expect(screen.queryByText('No hydration history yet')).toBeNull();
  });
});
