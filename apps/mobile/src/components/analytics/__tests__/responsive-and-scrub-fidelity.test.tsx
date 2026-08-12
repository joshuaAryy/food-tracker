import { act, render } from '@/test/render';
import { Dimensions, View } from 'react-native';
import { ComparePicker } from '@/app/trends/compare-picker';
import { LineTrendChart } from '../charts/line-trend-chart';
import { TrendReportHeader } from '../trends/trend-report-header';

describe('responsive and active-scrub fidelity', () => {
  beforeEach(() => {
    jest.spyOn(Dimensions, 'get').mockImplementation(() => ({
      width: 320,
      height: 693,
      scale: 2,
      fontScale: 1,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the Simple trend header usable at 320pt without Complex controls', async () => {
    const screen = await render(
      <View testID="compact-320-screen" style={{ width: 320 }}>
        <TrendReportHeader
          metricName="Calories"
          subtitle="Daily intake"
          trackingMode="simple"
          selectedPeriod={30}
          onSelectPeriod={jest.fn()}
        />
      </View>,
    );
    expect(screen.getByTestId('compact-320-screen').props.style).toEqual({
      width: 320,
    });

    for (const label of ['7D', '30D', '90D']) {
      expect(
        screen.getByRole('button', { name: label }).props.className,
      ).toContain('min-h-11');
    }
    expect(screen.queryByRole('button', { name: 'Custom' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Configure' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('keeps the 320pt comparison picker rows readable and selectable', async () => {
    const screen = await render(
      <View testID="compact-320-screen" style={{ width: 320 }}>
        <ComparePicker
          primaryMetric="calories"
          definitions={[
            {
              key: 'protein',
              displayName: 'Protein',
              group: 'general',
              unit: 'g',
              simpleAvailable: true,
              complexAvailable: true,
              searchableTerms: ['protein'],
              supportedVisualizations: ['automatic'],
              supportedAggregations: ['automatic'],
              supportedCoverageFilters: ['all_logged_days'],
              referenceSupport: 'target',
            },
            {
              key: 'weight',
              displayName: 'Weight',
              group: 'body',
              unit: 'lb',
              simpleAvailable: true,
              complexAvailable: true,
              searchableTerms: ['weight'],
              supportedVisualizations: ['automatic'],
              supportedAggregations: ['automatic'],
              supportedCoverageFilters: [],
              referenceSupport: 'target',
            },
            {
              key: 'carbs',
              displayName: 'Carbohydrates',
              group: 'general',
              unit: 'g',
              simpleAvailable: true,
              complexAvailable: true,
              searchableTerms: ['carbohydrates'],
              supportedVisualizations: ['automatic'],
              supportedAggregations: ['automatic'],
              supportedCoverageFilters: ['all_logged_days'],
              referenceSupport: 'target',
            },
          ]}
          selectedMetric="weight"
          onSelect={jest.fn()}
          onClose={jest.fn()}
        />
      </View>,
    );
    expect(screen.getByTestId('compact-320-screen').props.style).toEqual({
      width: 320,
    });

    expect(screen.getByText('Compare with')).toBeTruthy();
    expect(screen.getByText('All compatible')).toBeTruthy();
    for (const label of [
      'Compare with Protein',
      'Compare with Weight',
      'Compare with Carbohydrates',
    ]) {
      expect(
        screen.getByRole('button', { name: label }).props.className,
      ).toContain('min-h');
    }
    expect(screen.getByText(/Normalized views are reserved/)).toBeTruthy();
  });

  it('keeps active scrub accessible at compact chart widths and preserves null values', async () => {
    const screen = await render(
      <LineTrendChart
        data={[
          { date: '2026-07-28', value: 1800 },
          { date: '2026-07-29', value: null },
          { date: '2026-07-30', value: 2490 },
        ]}
        width={240}
        height={150}
        color="#111111"
        accessibilityLabel="Calories trend"
      />,
    );

    const scrubber = screen.getByLabelText('Inspect chart values');
    expect(scrubber.props.accessibilityRole).toBe('adjustable');
    expect(scrubber.props.accessibilityActions).toEqual([
      { name: 'increment', label: 'Next date' },
      { name: 'decrement', label: 'Previous date' },
    ]);
    await act(async () => {
      scrubber.props.onAccessibilityAction({
        nativeEvent: { actionName: 'increment' },
      });
    });
    expect(await screen.findByText('Jul 29: No recorded value')).toBeTruthy();
  });
});
