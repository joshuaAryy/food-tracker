import { render } from '@/test/render';
import { BarTrendChart } from '../bar-trend-chart';
import { LineTrendChart } from '../line-trend-chart';

const data = [
  { date: '2026-08-01', value: 100 },
  { date: '2026-08-02', value: null },
  { date: '2026-08-03', value: 240 },
] as const;

describe('detailed chart axes', () => {
  it.each([
    ['bars', BarTrendChart],
    ['lines', LineTrendChart],
  ] as const)(
    'renders real temporal, numeric, and reference context for %s',
    async (_, Chart) => {
      const screen = await render(
        <Chart
          data={data}
          width={300}
          height={140}
          color="#C9242D"
          showAxes
          periodDays={30}
          unit="mg"
          referenceLabel="Minimum · 90 mg"
          {...(Chart === LineTrendChart ? { showRawPoints: true } : {})}
          accessibilityLabel="Detailed nutrient trend"
        />,
      );

      expect(screen.getByText('mg')).toBeTruthy();
      expect(screen.getByText('Aug 1')).toBeTruthy();
      expect(screen.getByText('Aug 3')).toBeTruthy();
      expect(screen.getByText('Minimum · 90 mg')).toBeTruthy();
      expect(screen.getByTestId('chart-y-axis')).toBeTruthy();
      expect(screen.getByTestId('chart-x-axis')).toBeTruthy();
    },
  );

  it('keeps a missing raw observation as an empty date slot', async () => {
    const screen = await render(
      <BarTrendChart
        data={data}
        width={300}
        height={140}
        color="#C9242D"
        showAxes
        periodDays={30}
        unit="mg"
        accessibilityLabel="Detailed nutrient trend"
      />,
    );

    expect(screen.getByTestId('chart-x-axis')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain('"index":1,"x"');
  });
});
