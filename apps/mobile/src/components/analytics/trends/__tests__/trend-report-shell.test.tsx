import * as Haptics from 'expo-haptics';
import { act, render, userEvent } from '@/test/render';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { TrendContributorsCard } from '../trend-contributors-card';
import { TrendCoverageCard } from '../trend-coverage-card';
import { TrendReportHeader } from '../trend-report-header';
import { TrendSummaryCard } from '../trend-summary-card';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}));

describe('shared trend report shell', () => {
  it('keeps the final header controls within the Simple/Complex boundary', async () => {
    const onSelectPeriod = jest.fn();
    const onConfigure = jest.fn();
    const onSave = jest.fn();
    const onCustomRange = jest.fn();
    const screen = await render(
      <TrendReportHeader
        metricName="Calories"
        subtitle="Daily intake"
        trackingMode="simple"
        selectedPeriod={30}
        onSelectPeriod={onSelectPeriod}
        onOpenCustomRange={onCustomRange}
      />,
    );

    expect(screen.getByText('Trends')).toBeTruthy();
    expect(screen.getByText('Calories')).toBeTruthy();
    expect(screen.getByRole('button', { name: '30D' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Configure' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Custom' })).toBeNull();

    const complex = await render(
      <TrendReportHeader
        metricName="Calories"
        subtitle="Daily intake"
        trackingMode="complex"
        selectedPeriod={30}
        onSelectPeriod={onSelectPeriod}
        onOpenCustomRange={onCustomRange}
        onConfigure={onConfigure}
        onSave={onSave}
      />,
    );
    await userEvent
      .setup()
      .press(complex.getByRole('button', { name: 'Save' }));
    await userEvent
      .setup()
      .press(complex.getByRole('button', { name: 'Configure' }));
    await userEvent
      .setup()
      .press(complex.getByRole('button', { name: 'Custom' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onConfigure).toHaveBeenCalledTimes(1);
    expect(onCustomRange).toHaveBeenCalledTimes(1);
  });

  it('renders summary, logging coverage, and metric availability as separate slots', async () => {
    const screen = await render(
      <>
        <TrendSummaryCard
          title="1,846 kcal"
          caption="Average across 30 days"
          comparison="4% below previous 30 days"
        />
        <TrendCoverageCard
          logging={{ complete: 21, partial: 3, unlogged: 3, inProgress: 1 }}
          metric={{ recorded: 20, partial: 2, unknown: 5 }}
        />
      </>,
    );

    expect(screen.getByText('1,846 kcal')).toBeTruthy();
    expect(screen.getByText('4% below previous 30 days')).toBeTruthy();
    expect(
      screen.getByText('21 complete · 3 partial · 3 unlogged'),
    ).toBeTruthy();
    expect(
      screen.getByText('20 recorded · 2 partial · 5 unknown metric days'),
    ).toBeTruthy();
  });

  it('keeps contributor content canonical and provides a single handoff action', async () => {
    const onOpenAll = jest.fn();
    const screen = await render(
      <TrendContributorsCard
        contributors={[
          { foodName: 'Chicken rice bowl', value: 460, percentage: 18 },
          { foodName: 'Oatmeal and milk', value: 310, percentage: 12 },
        ]}
        onOpenAll={onOpenAll}
      />,
    );

    expect(screen.getByText('1. Chicken rice bowl')).toBeTruthy();
    expect(screen.getByText('18%')).toBeTruthy();
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'See all contributors' }));
    expect(onOpenAll).toHaveBeenCalledTimes(1);
  });

  it('retains null gaps and exposes active selection through accessibility', async () => {
    const screen = await render(
      <LineTrendChart
        data={[
          { date: '2026-07-28', value: 1800 },
          { date: '2026-07-29', value: null },
          { date: '2026-07-30', value: 2490 },
        ]}
        width={300}
        color="#111111"
        accessibilityLabel="Calories trend"
      />,
    );

    const chart = screen.getByLabelText('Inspect chart values');
    await act(async () => {
      chart.props.onAccessibilityAction({
        nativeEvent: { actionName: 'increment' },
      });
    });
    expect(await screen.findByText('Jul 29: No recorded value')).toBeTruthy();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });
});
