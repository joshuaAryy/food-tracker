import { render, userEvent } from '@/test/render';
import { caloriesTrendFixture } from '@/test-fixtures/analytics-fixtures';
import { HydrationReport } from '../hydration-report';
import { LoggingConsistencyReport } from '../logging-consistency-report';
import { MacrosReport } from '../macros-report';
import { WeightReport } from '../weight-report';

const base = caloriesTrendFixture;

describe('metric-specific trend reports', () => {
  it('keeps Weight direction and custom controls authoritative and mode-scoped', async () => {
    const screen = await render(
      <WeightReport
        trend={{
          ...base,
          trackingMode: 'simple',
          primaryMetric: 'weight',
          reference: { kind: 'target', value: 130, unit: 'lb', source: 'user' },
          weightFacts: {
            current: 129.4,
            change: -1.7,
            direction: 'down',
            target: 130,
            goalPath: 'moving_toward',
          },
        }}
        width={390}
        simple
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
      />,
    );

    expect(screen.getByText('129.4 lb')).toBeTruthy();
    expect(
      screen.getByText('Your weight trend is moving toward your goal.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Custom' })).toBeNull();
  });

  it('renders backend macro percentages without calculating them in the client', async () => {
    const screen = await render(
      <MacrosReport
        trend={{
          ...base,
          trackingMode: 'complex',
          primaryMetric: 'macroComposition',
          macroComposition: { protein: 120, carbs: 240, fat: 60 },
          macroPercentages: { protein: 24, carbs: 49, fat: 27 },
        }}
        width={390}
        simple={false}
        proteinTrend={base}
        proteinTrendLoading={false}
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
      />,
    );

    expect(screen.getByText('Protein · 24%')).toBeTruthy();
    expect(screen.getByText('Carbohydrates · 49%')).toBeTruthy();
    expect(screen.getByText('Fat · 27%')).toBeTruthy();
    expect(screen.getByText('Protein trend')).toBeTruthy();
  });

  it('keeps Logging Consistency states and current phase from backend summary', async () => {
    const screen = await render(
      <LoggingConsistencyReport
        trend={{
          ...base,
          trackingMode: 'simple',
          primaryMetric: 'loggingConsistency',
          loggingSummary: {
            complete: 21,
            partial: 3,
            unlogged: 3,
            inProgress: 1,
            consistency: 89,
            currentDayPhase: 'in_progress',
            mealCoverage: [],
          },
        }}
        simple
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
      />,
    );

    expect(
      screen.getByText('Complete 21 · Partial 3 · Unlogged 3'),
    ).toBeTruthy();
    expect(screen.getByText('Today is still in progress.')).toBeTruthy();
  });

  it('keeps Hydration water-only and exposes the canonical Log water action', async () => {
    const onLogWater = jest.fn();
    const screen = await render(
      <HydrationReport
        trend={{
          ...base,
          trackingMode: 'complex',
          primaryMetric: 'hydration',
          reference: {
            kind: 'target',
            value: 2000,
            unit: 'mL',
            source: 'default',
          },
          summary: { numericDayCount: 7, average: 1500 },
        }}
        width={390}
        onLogWater={onLogWater}
      />,
    );

    expect(
      screen.getByText('Explicitly logged drinks only · Goal 2000 mL/day'),
    ).toBeTruthy();
    expect(screen.getByText('1.5 L')).toBeTruthy();
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Log water' }));
    expect(onLogWater).toHaveBeenCalledTimes(1);
  });
});
