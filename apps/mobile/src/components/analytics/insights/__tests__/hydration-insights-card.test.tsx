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
});
