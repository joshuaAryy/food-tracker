import { render } from '@/test/render';
import { caloriesTrendFixture } from '@/test-fixtures/analytics-fixtures';
import { LoggingConsistencyReport } from '../logging-consistency-report';

describe('LoggingConsistencyReport', () => {
  it('makes an actual 30-day in-progress day independently readable without adding cells', async () => {
    const screen = await render(
      <LoggingConsistencyReport
        trend={{
          ...caloriesTrendFixture,
          trackingMode: 'simple',
          primaryMetric: 'loggingConsistency',
          aggregation: 'daily',
          points: [
            {
              kind: 'daily',
              date: '2026-08-01',
              loggingDayState: 'complete',
              loggingDayPhase: 'closed',
              metricDataState: 'recorded',
              value: 1000,
              foodLogCount: 1,
              metricRecordedLogCount: 1,
              metricUnknownLogCount: 0,
            },
            {
              kind: 'daily',
              date: '2026-08-02',
              loggingDayState: 'partial',
              loggingDayPhase: 'closed',
              metricDataState: 'partial',
              value: 800,
              foodLogCount: 1,
              metricRecordedLogCount: 1,
              metricUnknownLogCount: 0,
            },
            {
              kind: 'daily',
              date: '2026-08-03',
              loggingDayState: 'unlogged',
              loggingDayPhase: 'in_progress',
              metricDataState: null,
              value: null,
              foodLogCount: 0,
              metricRecordedLogCount: 0,
              metricUnknownLogCount: 0,
            },
          ],
          loggingSummary: {
            complete: 1,
            partial: 1,
            unlogged: 0,
            inProgress: 1,
            consistency: 100,
            currentDayPhase: 'in_progress',
            mealCoverage: [],
          },
        }}
        simple
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
      />,
    );

    expect(screen.getByText('In progress').props.style).toEqual(
      expect.objectContaining({ color: '#D99000' }),
    );
    expect(screen.getByLabelText('Aug 3: in_progress').props.style).toEqual(
      expect.objectContaining({ backgroundColor: '#D99000' }),
    );
    expect(
      screen.getByTestId('logging-consistency-heatmap-grid').props.children,
    ).toHaveLength(3);
  });

  it('uses a roomy weekly 90-day composition instead of compressed daily cells', async () => {
    const screen = await render(
      <LoggingConsistencyReport
        trend={{
          ...caloriesTrendFixture,
          trackingMode: 'simple',
          primaryMetric: 'loggingConsistency',
          aggregation: 'weekly',
          points: Array.from({ length: 13 }, (_, index) => ({
            kind: 'aggregated' as const,
            bucketStartDate: `2026-05-${String(index + 1).padStart(2, '0')}`,
            bucketEndDate: `2026-05-${String(index + 7).padStart(2, '0')}`,
            value: 75,
            loggingCounts: {
              complete: 4,
              partial: 1,
              inProgress: 0,
              unlogged: 2,
            },
            metricCounts: { recorded: 0, partial: 0, unknown: 7 },
            numericDayCount: 5,
          })),
          rollingTrend: {
            window: 4,
            values: Array.from({ length: 13 }, () => 75),
          },
          loggingSummary: {
            complete: 54,
            partial: 18,
            unlogged: 17,
            inProgress: 1,
            consistency: 80,
            currentDayPhase: 'in_progress',
            mealCoverage: Array.from({ length: 7 }, (_, index) => ({
              date: `2026-08-${String(index + 1).padStart(2, '0')}`,
              breakfast: true,
              lunch: true,
              dinner: true,
              snack: false,
            })),
          },
        }}
        simple
        selectedPeriod={90}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
      />,
    );

    expect(screen.queryByText('DAILY COMPLETENESS')).toBeNull();
    expect(
      screen.getByTestId('logging-consistency-meal-card').props.style,
    ).toEqual(expect.objectContaining({ minHeight: 270 }));
    expect(
      screen.getByTestId('logging-consistency-period-card').props.style,
    ).toEqual(expect.objectContaining({ minHeight: 330 }));
    expect(
      screen.getByText(
        'Weekly completeness keeps the 90-day pattern readable without compressing individual daily cells.',
      ),
    ).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain('"height":254');
  });
});
