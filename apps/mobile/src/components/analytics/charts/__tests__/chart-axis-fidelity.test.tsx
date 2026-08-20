import { render } from '@/test/render';
import { chartStyleForMetric } from '@/lib/analytics/chart-style';
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

  it('renders a styled hybrid chart with quiet raw bars and two range bounds', async () => {
    const style = chartStyleForMetric('calories');
    const screen = await render(
      <BarTrendChart
        data={data}
        width={300}
        height={140}
        color="#C9242D"
        chartStyle={style}
        trendValues={[110, 140, 190]}
        referenceRange={{ lower: 90, upper: 180 }}
        accessibilityLabel="Styled calories trend"
      />,
    );

    expect(screen.getByTestId('raw-bar-0').props).toEqual(
      expect.objectContaining({
        fill: expect.objectContaining({ payload: 0xffedede8 }),
        stroke: expect.objectContaining({ payload: 0xffc9c9c2 }),
        opacity: style.raw.opacity,
      }),
    );
    expect(screen.queryByTestId('raw-bar-1')).toBeNull();
    expect(screen.getByTestId('trend-path').props).toEqual(
      expect.objectContaining({
        stroke: expect.objectContaining({ payload: 0xff0e0e0e }),
        strokeWidth: style.trend.width,
      }),
    );
    expect(screen.getByTestId('reference-bound-lower')).toBeTruthy();
    expect(screen.getByTestId('reference-bound-upper')).toBeTruthy();
    expect(screen.getByTestId('reference-range-band')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain(
      'RNSVGLinearGradient',
    );
  });

  it('applies the unified style to line previews without a heavy range band', async () => {
    const style = chartStyleForMetric('calories');
    const screen = await render(
      <LineTrendChart
        data={data}
        width={300}
        height={140}
        color="#C9242D"
        chartStyle={style}
        trendValues={[110, 140, 190]}
        referenceRange={{ lower: 90, upper: 180 }}
        accessibilityLabel="Styled calories preview"
      />,
    );

    expect(screen.getByTestId('trend-path').props).toEqual(
      expect.objectContaining({
        stroke: expect.objectContaining({ payload: 0xff0e0e0e }),
        strokeWidth: style.trend.width,
      }),
    );
    expect(screen.getByTestId('reference-bound-lower')).toBeTruthy();
    expect(screen.getByTestId('reference-bound-upper')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain(
      'RNSVGLinearGradient',
    );
  });
});
