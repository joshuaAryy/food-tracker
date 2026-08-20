import { render } from '@/test/render';
import { macroColors } from '@/lib/analytics/macro-geometry';
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

  it('does not render a daily-value segment when its authoritative value is missing', async () => {
    const screen = await render(
      <MacroDailyMixChart
        days={[{ date: '2026-08-03', protein: null, carbs: 49, fat: null }]}
      />,
    );

    expect(screen.getByLabelText('Aug 3 macro composition')).toBeTruthy();
    expect(screen.getAllByTestId('macro-daily-mix-segment-carbs')).toHaveLength(
      1,
    );
    expect(screen.queryByTestId('macro-daily-mix-segment-protein')).toBeNull();
    expect(screen.queryByTestId('macro-daily-mix-segment-fat')).toBeNull();
  });

  it('uses the shared macro identities for daily segment colors', async () => {
    const screen = await render(
      <MacroDailyMixChart
        days={[{ date: '2026-08-03', protein: 24, carbs: 49, fat: 27 }]}
      />,
    );

    expect(
      screen.getByTestId('macro-daily-mix-segment-protein').props.style,
    ).toEqual(
      expect.objectContaining({ backgroundColor: macroColors.protein }),
    );
    expect(
      screen.getByTestId('macro-daily-mix-segment-carbs').props.style,
    ).toEqual(expect.objectContaining({ backgroundColor: macroColors.carbs }));
    expect(
      screen.getByTestId('macro-daily-mix-segment-fat').props.style,
    ).toEqual(expect.objectContaining({ backgroundColor: macroColors.fat }));
  });
});
