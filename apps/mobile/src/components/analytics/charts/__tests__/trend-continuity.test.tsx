import { render } from '@/test/render';
import { BarTrendChart } from '../bar-trend-chart';
import { LineTrendChart } from '../line-trend-chart';

const sparseDailyData = [
  { date: '2026-08-01', value: 10 },
  { date: '2026-08-02', value: null },
  { date: '2026-08-03', value: 20 },
] as const;

describe('derived trend continuity', () => {
  it('bridges a missing daily observation in the line-chart derived trend', async () => {
    const screen = await render(
      <LineTrendChart
        data={sparseDailyData}
        trendValues={[10, null, 20]}
        width={100}
        height={100}
        color="#111111"
        accessibilityLabel="Sparse line trend"
      />,
    );

    expect(JSON.stringify(screen.toJSON())).toContain(
      'M 0 100 C 33.333 66.667 66.667 33.333 100 0',
    );
  });

  it('bridges a missing daily observation in the bar-chart derived trend', async () => {
    const screen = await render(
      <BarTrendChart
        data={sparseDailyData}
        trendValues={[10, null, 20]}
        width={100}
        height={100}
        color="#111111"
        accessibilityLabel="Sparse bar trend"
      />,
    );

    expect(JSON.stringify(screen.toJSON())).toContain(
      'M 0 50 C 33.333 33.333 66.667 16.667 100 0',
    );
  });
});
