import type { AnalyticsOverviewNutrientHighlight } from '@food-tracker/shared';
import { render } from '@/test/render';
import { NutrientHighlightsCard } from '../nutrient-highlights-card';

const fiber: AnalyticsOverviewNutrientHighlight = {
  metric: 'fiber',
  value: 28.9,
  unit: 'g',
  availability: 'recorded',
  reference: {
    kind: 'minimum',
    value: 30,
    unit: 'g',
    source: 'user',
  },
  status: 'below_minimum',
};

const sodium: AnalyticsOverviewNutrientHighlight = {
  metric: 'sodium',
  value: 2_300,
  unit: 'mg',
  availability: 'recorded',
  reference: {
    kind: 'limit',
    value: 2_300,
    unit: 'mg',
    source: 'user',
  },
  status: 'within_limit',
};

const vitaminC: AnalyticsOverviewNutrientHighlight = {
  metric: 'vitaminC',
  value: null,
  unit: 'mg',
  availability: 'unknown',
  reference: { kind: 'none', unit: 'mg', reason: 'not_configured' },
  status: 'unknown',
};

describe('NutrientHighlightsCard fidelity', () => {
  it('gives a recorded nutrient a full-height gauge with an explicit reference label', async () => {
    const screen = await render(
      <NutrientHighlightsCard
        overview={{
          status: 'available',
          data: { highlights: [fiber, sodium, vitaminC] },
          fetchedAt: '2026-08-18T12:00:00.000Z',
          error: null,
          retryable: false,
        }}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText('Fiber')).toBeTruthy();
    expect(screen.getByText('28.9 g')).toBeTruthy();
    expect(screen.getByText('Minimum · 30 g')).toBeTruthy();
    expect(
      screen.getByTestId('nutrient-highlight-fiber-gauge').props.className,
    ).toContain('h-5');
    expect(
      screen.getByTestId('nutrient-highlight-fiber-marker').props.className,
    ).toContain('h-5');
  });
});
