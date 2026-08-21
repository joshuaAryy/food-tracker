import { act } from '@testing-library/react-native';
import { render } from '@/test/render';
import { ComparisonChart } from '../comparison-chart';
import { ComparisonTrendReport } from '../../trends/comparison-trend-report';

const dates = Array.from(
  { length: 7 },
  (_, index) => `2026-08-${String(index + 4).padStart(2, '0')}`,
);

const primary = dates.map((date, index) => ({
  date,
  value: 20 + index,
}));

const comparison = dates.map((date, index) => ({
  date,
  value: 40 + index,
}));

describe('comparison chart fidelity', () => {
  it('uses one readable date axis and shared selection guide for both series', async () => {
    const screen = await render(
      <ComparisonChart
        primary={primary}
        comparison={comparison}
        strategy="dual_axis"
        primaryAxis={{ minimum: 20, maximum: 26 }}
        comparisonAxis={{ minimum: 40, maximum: 46 }}
        primaryAxisLabel="Protein · g"
        comparisonAxisLabel="Iron · mg"
        width={390}
        accessibilityLabel="Protein and iron comparison"
      />,
    );

    expect(screen.getByTestId('comparison-chart-x-axis')).toBeTruthy();
    expect(screen.getByText('Aug 4')).toBeTruthy();
    expect(screen.getByText('Aug 10')).toBeTruthy();
    expect(
      screen.getByTestId('comparison-primary-series').props.stroke,
    ).toEqual(expect.objectContaining({ payload: 4291372077 }));
    expect(
      screen.getByTestId('comparison-secondary-series').props.stroke,
    ).toEqual(expect.objectContaining({ payload: 4286225270 }));

    const scrubber = screen.getByRole('adjustable');
    await act(async () => {
      scrubber.props.onAccessibilityAction({
        nativeEvent: { actionName: 'increment' },
      });
    });

    expect(screen.getByTestId('comparison-selected-guide')).toBeTruthy();
    expect(screen.getByText('Aug 5')).toBeTruthy();
  });

  it('keeps the legend colors aligned with the plotted series', async () => {
    const screen = await render(
      <ComparisonTrendReport
        primaryMetric="protein"
        comparisonMetric="iron"
        strategy="dual_axis"
        primary={primary}
        comparison={comparison}
        primaryAxis={{ minimum: 20, maximum: 26 }}
        comparisonAxis={{ minimum: 40, maximum: 46 }}
        primaryAverage={23}
        width={390}
      />,
    );

    expect(screen.getByTestId('comparison-primary-legend').props.style).toEqual(
      expect.objectContaining({ color: '#C9242D' }),
    );
    expect(
      screen.getByTestId('comparison-secondary-legend').props.style,
    ).toEqual(expect.objectContaining({ color: '#7A9B76' }));
  });
});
