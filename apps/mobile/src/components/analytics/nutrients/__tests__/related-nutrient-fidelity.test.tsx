import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { render, userEvent } from '@/test/render';
import { NutrientPairReport } from '../nutrient-pair-report';

const related: CanonicalTrendResponse = {
  timezone: 'America/New_York',
  trackingMode: 'complex',
  primaryMetric: 'vitaminC',
  aggregation: 'daily',
  resolvedRange: { startDate: '2026-07-06', endDate: '2026-08-04' },
  firstEligibleDate: null,
  today: '2026-08-04',
  reference: {
    kind: 'range',
    lower: 75,
    upper: 120,
    unit: 'mg',
    source: 'default',
  },
  interpretation: null,
  relatedMetrics: ['iron'],
  points: [],
  summary: { numericDayCount: 24, average: 96 },
};

describe('related nutrient detail fidelity', () => {
  it('renders paired metric identity, references, and navigation', async () => {
    const onOpen = jest.fn();
    const screen = await render(
      <NutrientPairReport
        primaryName="Iron"
        primaryReference={{
          kind: 'range',
          lower: 14,
          upper: 18,
          unit: 'mg',
          source: 'default',
        }}
        relatedName="Vitamin C"
        relatedMetric="vitaminC"
        relatedTrend={related}
        comparisonTrend={null}
        relatedError={null}
        onOpenRelated={onOpen}
      />,
    );

    expect(screen.getByText('Related metric')).toBeTruthy();
    expect(screen.getByText('Vitamin C')).toBeTruthy();
    expect(screen.getByText('96 mg average')).toBeTruthy();
    expect(screen.getByText('Range · 75–120 mg')).toBeTruthy();
    await userEvent
      .setup()
      .press(
        screen.getByRole('button', { name: 'Open Vitamin C paired view' }),
      );
    expect(onOpen).toHaveBeenCalledWith('vitaminC');
  });

  it('keeps the primary nutrient usable when the related metric fails', async () => {
    const screen = await render(
      <NutrientPairReport
        primaryName="Sodium"
        primaryReference={{
          kind: 'limit',
          value: 2300,
          unit: 'mg',
          source: 'default',
        }}
        relatedName="Potassium"
        relatedMetric="potassium"
        relatedTrend={null}
        comparisonTrend={null}
        relatedError="Related metric unavailable"
        onOpenRelated={jest.fn()}
      />,
    );

    expect(screen.getByText('Sodium')).toBeTruthy();
    expect(screen.getByText('Limit · no more than 2,300 mg')).toBeTruthy();
    expect(screen.getByText('Related metric unavailable')).toBeTruthy();
    expect(
      screen.getByText('Primary nutrient remains available.'),
    ).toBeTruthy();
  });

  it('uses backend normalized points for the Sodium and Potassium paired chart', async () => {
    const screen = await render(
      <NutrientPairReport
        primaryName="Sodium"
        primaryReference={{
          kind: 'limit',
          value: 2300,
          unit: 'mg',
          source: 'default',
        }}
        relatedName="Potassium"
        relatedMetric="potassium"
        relatedTrend={related}
        comparisonTrend={{
          ...related,
          primaryMetric: 'sodium',
          points: [],
          comparison: {
            strategy: 'reference_normalized',
            metric: 'potassium',
            points: [],
            reference: related.reference,
            sharedAxisDomain: { minimum: 0, maximum: 1.2 },
            primaryAxisDomain: { minimum: 0, maximum: 1.2 },
            comparisonAxisDomain: { minimum: 0, maximum: 1.2 },
          },
        }}
        relatedError={null}
        onOpenRelated={jest.fn()}
      />,
    );

    expect(screen.getByText('Normalized paired trend')).toBeTruthy();
    expect(screen.getByText('% of own target / limit')).toBeTruthy();
  });
});
