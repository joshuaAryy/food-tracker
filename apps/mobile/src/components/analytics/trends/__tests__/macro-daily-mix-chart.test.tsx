import { render } from '@/test/render';
import { MacroDailyMixChart } from '../macro-daily-mix-chart';

describe('MacroDailyMixChart', () => {
  it('uses the narrow, rounded Figma stacked-bar geometry', async () => {
    const screen = await render(
      <MacroDailyMixChart
        days={[{ date: '2026-08-03', protein: 24, carbs: 49, fat: 27 }]}
      />,
    );

    expect(screen.getByTestId('macro-daily-mix-bar').props.className).toContain(
      'w-3',
    );
    expect(screen.getByTestId('macro-daily-mix-bar').props.className).toContain(
      'rounded-t-[5px]',
    );
  });
});
