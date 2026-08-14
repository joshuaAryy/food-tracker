import {
  analyticsMetricsForMode,
  type AnalyticsSavedView,
} from '@food-tracker/shared';
import { ExploreAll } from '../explore-all';
import { render, userEvent } from '@/test/render';

const savedView: AnalyticsSavedView = {
  id: 'saved-view-1',
  name: 'Protein + Weight',
  primaryMetric: 'protein',
  comparisonMetric: 'weight',
  periodDays: 90,
  aggregation: 'automatic',
  visualization: 'dual_axis',
  showReference: true,
  coverageFilter: 'all_logged_days',
  sortOrder: 0,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  unavailableMetrics: [],
};

describe('Complex Explore fidelity', () => {
  it('renders saved views, grouped metrics, search, and nutrient-library entry', async () => {
    const onMetric = jest.fn();
    const onOpenSavedView = jest.fn();
    const onLibrary = jest.fn();
    const screen = await render(
      <ExploreAll
        definitions={analyticsMetricsForMode('complex')}
        savedViews={[savedView]}
        pinnedSavedViewId={savedView.id}
        query="vit c"
        onQueryChange={jest.fn()}
        onBack={jest.fn()}
        onMetric={onMetric}
        onOpenSavedView={onOpenSavedView}
        onManageSavedViews={jest.fn()}
        onOpenNutrientLibrary={onLibrary}
      />,
    );

    expect(screen.getByText('Protein + Weight')).toBeTruthy();
    expect(screen.getByText('Protein + Weight').props.className).toContain(
      'flex-1',
    );
    expect(
      screen.getByTestId('saved-view-meta-saved-view-1').props.className,
    ).toContain('w-[40%]');
    expect(
      screen.getByText('PINNED · 90D · dual axis').props.className,
    ).toContain('text-right');
    expect(screen.getByText('Nutrients')).toBeTruthy();
    expect(screen.getByText('Complete nutrient library')).toBeTruthy();
    expect(screen.getByText('Vitamin C')).toBeTruthy();
    expect(screen.queryByText('Calories')).toBeNull();

    await userEvent.setup().press(
      screen.getByRole('button', {
        name: 'Open saved view: Protein + Weight',
      }),
    );
    expect(onOpenSavedView).toHaveBeenCalledWith(savedView);

    await userEvent
      .setup()
      .press(
        screen.getByRole('button', { name: 'Open complete nutrient library' }),
      );
    expect(onLibrary).toHaveBeenCalledTimes(1);
  });
});
