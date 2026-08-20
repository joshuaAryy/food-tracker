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

  it('centers its label stack and uses short white dividers at each macro boundary', async () => {
    const screen = await render(
      <MacroChart
        values={{ protein: 24, carbs: 49, fat: 27 }}
        size={124}
        centerValue="2,184"
        centerLabel="kcal avg"
        accessibilityLabel="Macro balance composition"
      />,
    );

    expect(screen.getByTestId('macro-donut-center').props.style).toEqual(
      expect.objectContaining({ left: 28, top: 28, width: 68, height: 68 }),
    );

    const separators = screen.getAllByTestId('macro-donut-separator');
    expect(separators).toHaveLength(3);
    for (const separator of separators) {
      expect(separator.props.stroke).toMatchObject({ payload: 4294967295 });
      expect(separator.props.strokeWidth).toBe(2);
      expect(
        Math.hypot(
          separator.props.x2 - separator.props.x1,
          separator.props.y2 - separator.props.y1,
        ),
      ).toBeLessThan(14);
    }
  });
});
