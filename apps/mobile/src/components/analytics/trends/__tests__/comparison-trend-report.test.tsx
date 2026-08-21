import { render } from '@/test/render';
import { ComparisonTrendReport } from '../comparison-trend-report';

const props = {
  primaryMetric: 'protein' as const,
  comparisonMetric: 'carbs' as const,
  primary: [
    { date: '2026-08-01', value: 80 },
    { date: '2026-08-02', value: 90 },
  ],
  comparison: [
    { date: '2026-08-01', value: 210 },
    { date: '2026-08-02', value: 190 },
  ],
  primaryAxis: { minimum: 0, maximum: 100 },
  comparisonAxis: { minimum: 0, maximum: 250 },
  primaryAverage: 85,
  width: 390,
};

describe('comparison trend report', () => {
  it.each([
    ['shared_unit', 'Shared raw scale · grams per day'],
    ['dual_axis', 'Dual-axis overlay · shared timeline'],
    ['reference_normalized', 'Normalized to each metric’s own reference'],
  ] as const)('renders the approved %s treatment', async (strategy, copy) => {
    const screen = await render(
      <ComparisonTrendReport {...props} strategy={strategy} />,
    );
    expect(screen.getByTestId('comparison-trend-report')).toBeTruthy();
    expect(screen.getAllByText(copy).length).toBeGreaterThan(0);
    expect(
      screen.getByLabelText('Protein and Carbohydrates comparison'),
    ).toBeTruthy();
  });
});
