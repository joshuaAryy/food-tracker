import { render } from '@/test/render';
import { ForecastUnavailableCard } from '../forecast-unavailable-card';

describe('forecast unavailable fidelity', () => {
  it.each([
    ['calories', 'Calorie forecast'],
    ['weight', 'Weight forecast'],
  ] as const)(
    'keeps the %s base trend contract visible without a fabricated line',
    async (metric, title) => {
      const screen = await render(<ForecastUnavailableCard metric={metric} />);
      expect(screen.getByTestId(`${metric}-forecast-unavailable`)).toBeTruthy();
      expect(screen.getByText(title)).toBeTruthy();
      expect(screen.getByText('Not enough recent data')).toBeTruthy();
      expect(screen.getByText(/no future line is fabricated/)).toBeTruthy();
    },
  );
});
