import { render } from '@/test/render';
import { ForecastChart } from '../forecast-chart';

describe('ForecastChart', () => {
  it('exposes the shared chart inspection control for forecast points', async () => {
    const screen = await render(
      <ForecastChart
        historical={[100, 110]}
        forecast={[{ value: 115, lower: 105, upper: 125 }]}
        width={280}
        accessibilityLabel="Calorie forecast"
      />,
    );

    expect(
      await screen.findByRole('adjustable', {
        name: 'Inspect chart values',
      }),
    ).toBeTruthy();
  });

  it('renders temporal and numeric axes when detailed dates are supplied', async () => {
    const screen = await render(
      <ForecastChart
        historical={[100, 110]}
        historicalDates={['2026-08-01', '2026-08-02']}
        forecast={[{ date: '2026-08-03', value: 115, lower: 105, upper: 125 }]}
        width={280}
        showAxes
        unit="kcal"
        accessibilityLabel="Calorie forecast"
      />,
    );

    expect(screen.getByTestId('chart-y-axis')).toBeTruthy();
    expect(screen.getByTestId('chart-x-axis')).toBeTruthy();
    expect(screen.getByText('kcal')).toBeTruthy();
    expect(screen.getByText('Aug 1')).toBeTruthy();
    expect(screen.getByText('Aug 3')).toBeTruthy();
  });
});
