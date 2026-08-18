import { render } from '@/test/render';
import { caloriesTrendFixture } from '@/test-fixtures/analytics-fixtures';
import { HydrationReport } from '../hydration-report';

describe('HydrationReport', () => {
  it('uses pale vessels without inventing missing daily values', async () => {
    const values = [1500, 1800, null, 1600, 1700, 1500, 1400];
    const points = values.map((value, index) => ({
      kind: 'daily' as const,
      date: `2026-08-${String(index + 4).padStart(2, '0')}`,
      value,
      metricDataState:
        value === null ? ('unknown' as const) : ('recorded' as const),
      loggingDayState:
        value === null ? ('unlogged' as const) : ('complete' as const),
      loggingDayPhase: 'closed' as const,
      foodLogCount: value === null ? 0 : 3,
      metricRecordedLogCount: value === null ? 0 : 3,
      metricUnknownLogCount: value === null ? 1 : 0,
    }));
    const screen = await render(
      <HydrationReport
        trend={{
          ...caloriesTrendFixture,
          primaryMetric: 'hydration',
          reference: {
            kind: 'target',
            value: 2000,
            unit: 'mL',
            source: 'user',
          },
          summary: {
            ...caloriesTrendFixture.summary,
            average: 1583,
            numericDayCount: 6,
          },
          points,
        }}
        width={390}
        onLogWater={jest.fn()}
      />,
    );

    expect(
      screen.getByTestId('hydration-daily-vessel-plot').props.style,
    ).toEqual(expect.objectContaining({ width: 272, height: 190 }));
    expect(screen.getByTestId('hydration-goal-reference').props).toEqual(
      expect.objectContaining({
        strokeDasharray: ['4', '4'],
        stroke: expect.objectContaining({ payload: 4281563847 }),
      }),
    );
    expect(screen.getByTestId('hydration-missing-observation-2')).toBeTruthy();
    expect(screen.queryByTestId('hydration-daily-vessel-2')).toBeNull();
    expect(screen.getByTestId('hydration-missing-observation-2').props).toEqual(
      expect.objectContaining({
        cy: expect.any(Number),
        r: 6,
      }),
    );
    expect(screen.getByText('9.5 L')).toBeTruthy();
    expect(
      screen.getByText('5 of 6 recorded days reached at least 75% of goal'),
    ).toBeTruthy();
  });

  it('keeps a selected endpoint marker inside its final daily slot', async () => {
    const screen = await render(
      <HydrationReport
        trend={{
          ...caloriesTrendFixture,
          primaryMetric: 'hydration',
          reference: {
            kind: 'target',
            value: 2000,
            unit: 'mL',
            source: 'user',
          },
          points: Array.from({ length: 7 }, (_, index) => ({
            kind: 'daily' as const,
            date: `2026-08-${String(index + 4).padStart(2, '0')}`,
            value: 1400,
            metricDataState: 'recorded' as const,
            loggingDayState: 'complete' as const,
            loggingDayPhase: 'closed' as const,
            foodLogCount: 3,
            metricRecordedLogCount: 3,
            metricUnknownLogCount: 0,
          })),
        }}
        width={390}
        onLogWater={jest.fn()}
      />,
    );

    const plotWidth = 272;
    const marker = screen.getByTestId('hydration-selected-observation').props;
    const finalVessel = screen.getByTestId('hydration-daily-vessel-6').props;

    expect(marker.cx).toBeCloseTo(finalVessel.x + finalVessel.width / 2);
    expect(marker.cy).toBeCloseTo(finalVessel.y);
    expect(marker.cx + marker.r).toBeLessThanOrEqual(plotWidth);
  });
});
