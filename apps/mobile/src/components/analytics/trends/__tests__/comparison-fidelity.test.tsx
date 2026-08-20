import { act, render } from '@/test/render';
import { ComparisonTrendReport } from '../comparison-trend-report';

const baseProps = {
  primaryMetric: 'protein' as const,
  comparisonMetric: 'weight' as const,
  primary: [
    { date: '2026-08-01', value: 80 },
    { date: '2026-08-02', value: 90 },
  ],
  comparison: [
    { date: '2026-08-01', value: 129 },
    { date: '2026-08-02', value: 129.4857142857143 },
  ],
  primaryAxis: { minimum: 0, maximum: 100 },
  comparisonAxis: { minimum: 128, maximum: 131 },
  primaryAverage: 85,
  width: 350,
};

describe('comparison report fidelity', () => {
  it('renders dual-axis ownership and an explicit comparison reading', async () => {
    const screen = await render(
      <ComparisonTrendReport {...baseProps} strategy="dual_axis" />,
    );

    expect(
      screen.getAllByText('Dual-axis overlay · shared timeline').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Protein · g')).toBeTruthy();
    expect(screen.getByText('Weight · lb')).toBeTruthy();
    expect(screen.getByText('Comparison reading')).toBeTruthy();
    expect(
      screen.getByText(
        'Each metric keeps its own raw scale while one timeline and scrub position return both values for the same date.',
      ),
    ).toBeTruthy();
  });

  it('labels normalized comparisons as percent of each authoritative reference', async () => {
    const screen = await render(
      <ComparisonTrendReport
        {...baseProps}
        primaryMetric="sodium"
        comparisonMetric="potassium"
        strategy="reference_normalized"
        primary={[{ date: '2026-08-01', value: 1, normalizedValue: 1.15 }]}
        comparison={[{ date: '2026-08-01', value: 1, normalizedValue: 0.81 }]}
        primaryAxis={{ minimum: 0, maximum: 1.2 }}
        comparisonAxis={{ minimum: 0, maximum: 1.2 }}
      />,
    );

    expect(
      screen.getAllByText('Normalized to each metric’s own reference').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('% of own target / limit')).toBeTruthy();
    expect(screen.getByText('120%')).toBeTruthy();
  });

  it('shows both selected raw values in the visible scrub readout', async () => {
    const screen = await render(
      <ComparisonTrendReport {...baseProps} strategy="dual_axis" />,
    );
    const scrubber = screen.getByLabelText('Inspect chart values');
    await act(async () => {
      scrubber.props.onAccessibilityAction({
        nativeEvent: { actionName: 'increment' },
      });
    });

    expect(screen.getByTestId('comparison-selected-date')).toHaveTextContent(
      'Aug 2',
    );
    expect(screen.getByText('Protein · g: 90')).toBeTruthy();
    expect(screen.getByText('Weight · lb: 129.5')).toBeTruthy();
    expect(screen.getByText('Protein · g: 90').props.style).toEqual(
      expect.objectContaining({ color: '#C9242D' }),
    );
    expect(screen.getByText('Weight · lb: 129.5').props.style).toEqual(
      expect.objectContaining({ color: '#7A9B76' }),
    );
  });
});
