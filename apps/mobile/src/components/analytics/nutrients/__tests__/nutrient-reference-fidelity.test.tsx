import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { render } from '@/test/render';
import { NutrientGoalDepthCard } from '../nutrient-goal-depth-card';
import { NutrientReferenceSummary } from '../nutrient-reference-summary';

const base = {
  timezone: 'America/New_York',
  trackingMode: 'complex' as const,
  primaryMetric: 'fiber' as const,
  aggregation: 'daily' as const,
  resolvedRange: { startDate: '2026-07-06', endDate: '2026-08-04' },
  firstEligibleDate: null,
  today: '2026-08-04',
  interpretation: null,
  relatedMetrics: [],
  points: [],
  summary: { numericDayCount: 24, average: 28.9 },
} satisfies Omit<CanonicalTrendResponse, 'reference'>;

describe('nutrient reference fidelity', () => {
  it('renders target, minimum, limit, true-range, and unknown references without inventing bounds', () => {
    expect(
      render(
        <>
          <NutrientReferenceSummary
            reference={{
              kind: 'target',
              value: 30,
              unit: 'g',
              source: 'default',
            }}
          />
          <NutrientReferenceSummary
            reference={{
              kind: 'minimum',
              value: 25,
              unit: 'g',
              source: 'user',
            }}
          />
          <NutrientReferenceSummary
            reference={{
              kind: 'limit',
              value: 2300,
              unit: 'mg',
              source: 'default',
            }}
          />
          <NutrientReferenceSummary
            reference={{
              kind: 'range',
              lower: 75,
              upper: 120,
              unit: 'mg',
              source: 'user',
            }}
          />
          <NutrientReferenceSummary
            reference={{ kind: 'none', unit: 'mg', reason: 'not_configured' }}
          />
        </>,
      ),
    ).toBeTruthy();
  });

  it('keeps an unknown nutrient value unknown and reports goal depth from canonical facts', async () => {
    const screen = await render(
      <NutrientGoalDepthCard
        metricName="Fiber"
        unit="g"
        average={base.summary.average}
        metricCoverage={{ recorded: 24, partial: 0, unknown: 3 }}
        reference={{
          kind: 'minimum',
          value: 30,
          unit: 'g',
          source: 'default',
        }}
      />,
    );

    expect(screen.getByText('28.9 g')).toBeTruthy();
    expect(screen.getByText('Minimum · at least 30 g')).toBeTruthy();
    expect(
      screen.getByText('24 recorded · 3 unknown metric days'),
    ).toBeTruthy();

    const unknown = await render(
      <NutrientGoalDepthCard
        metricName="Vitamin C"
        unit="mg"
        average={null}
        metricCoverage={{ recorded: 0, partial: 0, unknown: 27 }}
        reference={{ kind: 'none', unit: 'mg', reason: 'not_configured' }}
      />,
    );
    expect(unknown.getByText('Unknown')).toBeTruthy();
    expect(unknown.getByText('Reference unavailable')).toBeTruthy();
  });
});
