import { render } from '@/test/render';
import { InsightsPeriodSummary } from '../insights-period-summary';

describe('InsightsPeriodSummary fidelity', () => {
  it('preserves the Figma month-summary geometry in compact overview mode', async () => {
    const screen = await render(
      <InsightsPeriodSummary
        period="month"
        summary={{
          status: 'available',
          fetchedAt: '2026-08-18T12:00:00.000Z',
          error: null,
          retryable: false,
          data: {
            resolvedRange: {
              startDate: '2026-07-19',
              endDate: '2026-08-18',
            },
            todaySoFar: {
              date: '2026-08-18',
              mealCount: 2,
              calories: { value: 1846, state: 'recorded' },
              protein: { value: 149, state: 'recorded' },
            },
            loggedDayCount: 27,
            eligibleLoggedDayCount: 27,
            eligibleTotalDayCount: 31,
            streak: { currentDays: 18, longestDays: 18 },
            currentDayPhase: 'in_progress',
            consistency: 87,
            interpretation: 'building',
          },
        }}
        onRetry={jest.fn()}
        compact
      />,
    );

    expect(
      screen.getByTestId('insights-period-summary-card').props.style,
    ).toEqual(expect.objectContaining({ minHeight: 154 }));
    expect(
      screen.getByTestId('insights-period-summary-card').props.className,
    ).toContain('p-[18px]');
    expect(screen.getByText('18 days').props.className).toContain(
      'text-[34px]',
    );
    expect(screen.getByText('18 days').props.className).toContain('leading-10');
  });
});
