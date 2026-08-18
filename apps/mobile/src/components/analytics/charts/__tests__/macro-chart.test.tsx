import { render } from '@/test/render';
import { MacroChart } from '../macro-chart';

describe('MacroChart', () => {
  it('keeps a readable center disc inside the 124pt Figma composition ring', async () => {
    const screen = await render(
      <MacroChart
        values={{ protein: 24, carbs: 49, fat: 27 }}
        size={124}
        centerValue="2,184"
        centerLabel="kcal avg"
        accessibilityLabel="Macro balance composition"
      />,
    );

    const centre = screen.getByTestId('macro-donut-center');
    const centreDisc = screen.getByTestId('macro-donut-center-disc');

    expect(centre.props.style).toEqual(
      expect.objectContaining({ width: 68, height: 68 }),
    );
    expect(centreDisc.props.r).toBe(34);
  });
});
