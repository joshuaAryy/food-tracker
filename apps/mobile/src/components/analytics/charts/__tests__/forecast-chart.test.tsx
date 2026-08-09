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
});
