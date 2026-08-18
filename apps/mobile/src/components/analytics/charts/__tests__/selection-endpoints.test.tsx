import { render } from '@/test/render';
import { BarTrendChart } from '../bar-trend-chart';
import { LineTrendChart } from '../line-trend-chart';

const endpointData = [
  { date: '2026-08-01', value: 10 },
  { date: '2026-08-02', value: 20 },
  { date: '2026-08-03', value: 30 },
] as const;

describe.each([
  ['line', LineTrendChart],
  ['bar', BarTrendChart],
] as const)('%s trend chart endpoint selection', (_, TrendChart) => {
  it.each([
    ['first', 0, 7.5],
    ['last', 2, 92.5],
  ] as const)(
    'keeps the %s selection guide and marker fully inside the plot',
    async (_, initialSelectedIndex, expectedX) => {
      const screen = await render(
        <TrendChart
          data={endpointData}
          width={100}
          height={100}
          color="#111111"
          initialSelectedIndex={initialSelectedIndex}
          accessibilityLabel="Endpoint trend"
        />,
      );

      const tree = JSON.stringify(screen.toJSON());
      expect(tree).toContain(`"x1":${expectedX},"y1":0,"x2":${expectedX}`);
      expect(tree).toContain(`"cx":${expectedX},`);
    },
  );
});
