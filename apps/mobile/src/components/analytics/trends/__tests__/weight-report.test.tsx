import { render } from '@/test/render';
import { caloriesTrendFixture } from '@/test-fixtures/analytics-fixtures';
import { WeightReport } from '../weight-report';

describe('WeightReport', () => {
  it('keeps the Figma plot geometry and surfaces an eligible forecast without replacing raw weigh-ins', async () => {
    const screen = await render(
      <WeightReport
        trend={{
          ...caloriesTrendFixture,
          primaryMetric: 'weight',
          reference: { kind: 'target', value: 130, unit: 'lb', source: 'user' },
          weightFacts: {
            current: 129.4,
            change: 1.7,
            direction: 'up',
            target: 130,
            goalPath: 'moving_toward',
            recordedDayCount: 18,
            eligibleDayCount: 30,
          },
          forecast: {
            kind: 'available',
            model: 'linear_trend',
            todayDate: '2026-08-04',
            horizonDays: 7,
            points: [
              {
                date: '2026-08-05',
                value: 129.5,
                lower: 129.2,
                upper: 129.8,
              },
              {
                date: '2026-08-06',
                value: 129.6,
                lower: 129.1,
                upper: 130.1,
              },
            ],
          },
        }}
        width={390}
        simple
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('weight-trend-chart').props.style).toEqual(
      expect.objectContaining({ height: 190, width: 272 }),
    );
    expect(screen.getByTestId('chart-y-axis')).toBeTruthy();
    expect(screen.getByTestId('chart-x-axis')).toBeTruthy();
    expect(screen.getByTestId('weight-goal-reference').props.style).toEqual(
      expect.objectContaining({ right: -4 }),
    );
    expect(screen.getByTestId('weight-forecast')).toBeTruthy();
    expect(screen.getByText('Weight forecast')).toBeTruthy();
    expect(screen.getByText('129.1–130.1 lb')).toBeTruthy();
    expect(screen.getByText('Raw points visible')).toBeTruthy();
    expect(
      screen.getAllByText(/\+1\.7 lb over the selected period\.?/),
    ).toHaveLength(1);
  });
});
