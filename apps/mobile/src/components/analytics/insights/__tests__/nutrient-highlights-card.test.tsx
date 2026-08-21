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
  value: 2_516,
  unit: 'mg',
  availability: 'recorded',
  reference: {
    kind: 'limit',
    value: 2_300,
    unit: 'mg',
    source: 'user',
  },
  status: 'above_limit',
};

const sodiumWithinLimit: AnalyticsOverviewNutrientHighlight = {
  ...sodium,
  value: 2_100,
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
    expect(screen.getByText('1.1 g remaining')).toBeTruthy();
    expect(
      screen.getByTestId('nutrient-highlight-fiber-gauge').props.className,
    ).toContain('h-[14px]');
    expect(
      screen.getByTestId('nutrient-highlight-fiber-marker').props.className,
    ).toContain('h-[14px]');
  });

  it('uses the Figma reminder-row gauge with a target marker and status detail instead of a stacked full-width bar', async () => {
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

    expect(screen.getByTestId('nutrient-highlights-card').props.style).toEqual(
      expect.objectContaining({ minHeight: 300 }),
    );
    expect(
      screen.getByTestId('nutrient-highlight-fiber-gauge').props.className,
    ).toContain('h-[14px]');
    expect(screen.getByText('1.1 g remaining')).toBeTruthy();
    expect(screen.getByText('216 mg over limit')).toBeTruthy();
    expect(screen.getByText('Unavailable')).toBeTruthy();
    expect(screen.getByText('Unknown')).toBeTruthy();
  });

  it('reserves red status copy for alerts while keeping the sodium gauge accent', async () => {
    const screen = await render(
      <NutrientHighlightsCard
        overview={{
          status: 'available',
          data: { highlights: [fiber, sodiumWithinLimit, vitaminC] },
          fetchedAt: '2026-08-18T12:00:00.000Z',
          error: null,
          retryable: false,
        }}
        onRetry={jest.fn()}
      />,
    );

    expect(
      screen.getByTestId('nutrient-highlight-sodium-status').props.style,
    ).not.toEqual(expect.objectContaining({ color: '#EB1226' }));
    expect(
      screen.getByTestId('nutrient-highlight-sodium-status').props.style,
    ).not.toEqual(expect.objectContaining({ color: '#C9242D' }));
    expect(
      screen.getByTestId('nutrient-highlight-sodium-reference-detail').props
        .style,
    ).not.toEqual(expect.objectContaining({ color: '#EB1226' }));
    expect(
      screen.getByTestId('nutrient-highlight-sodium-gauge-fill').props.style,
    ).toEqual(expect.objectContaining({ backgroundColor: '#EB1226' }));
  });
});
