import type {
  AnalyticsMetricDefinition,
  AnalyticsMetricKey,
} from '@food-tracker/shared';
import { render, userEvent } from '@/test/render';
import { ComparePicker } from '../compare-picker';

const definitions = [
  { key: 'protein', displayName: 'Protein' },
  { key: 'weight', displayName: 'Weight' },
  { key: 'carbs', displayName: 'Carbohydrates' },
] as AnalyticsMetricDefinition[];

describe('compare picker fidelity', () => {
  it('renders compatible suggestions and returns the selected metric', async () => {
    const onSelect = jest.fn();
    const screen = await render(
      <ComparePicker
        primaryMetric="calories"
        definitions={definitions}
        selectedMetric={null}
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Compare with')).toBeTruthy();
    expect(screen.getByText('Suggested with Calories')).toBeTruthy();
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Compare with Weight' }));
    expect(onSelect).toHaveBeenCalledWith('weight' as AnalyticsMetricKey);
  });
});
