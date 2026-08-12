import { analyticsMetricsForMode } from '@food-tracker/shared';
import { ExploreCurated } from '../explore-curated';
import { render, userEvent } from '@/test/render';

describe('curated Simple Explore fidelity', () => {
  it('keeps the approved groups and metric boundary', async () => {
    const onMetric = jest.fn();
    const screen = await render(
      <ExploreCurated
        definitions={analyticsMetricsForMode('simple')}
        preferredMetric="calories"
        onBack={jest.fn()}
        onMetric={onMetric}
      />,
    );

    expect(screen.getByText('Preferred trend')).toBeTruthy();
    expect(screen.getByText('Energy & macros')).toBeTruthy();
    expect(screen.getByText('Body & habits')).toBeTruthy();
    expect(screen.getByText('Macro composition')).toBeTruthy();
    expect(screen.queryByText('Fiber')).toBeNull();
    expect(screen.queryByText('Configure')).toBeNull();
    expect(screen.queryByText('Saved Views')).toBeNull();

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'View Calories trend' }));
    expect(onMetric).toHaveBeenCalledWith('calories');
  });
});
