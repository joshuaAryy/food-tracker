import { render } from '@/test/render';
import { NutrientDataState } from '../nutrient-data-state';
import { NutrientSparseState } from '../nutrient-sparse-state';

describe('nutrient data-state fidelity', () => {
  it('keeps no logs, not recorded, recorded zero, and available states distinct', async () => {
    const screen = await render(
      <NutrientDataState
        metricName="Vitamin D"
        state="no_food_logs"
        recorded={0}
        total={0}
      />,
    );
    expect(screen.getByText('No nutrition data yet')).toBeTruthy();

    const notRecorded = await render(
      <NutrientDataState
        metricName="Vitamin D"
        state="not_recorded"
        recorded={0}
        total={27}
      />,
    );
    expect(notRecorded.getByText('No recorded Vitamin D data')).toBeTruthy();

    const zero = await render(
      <NutrientDataState
        metricName="Vitamin D"
        state="recorded_zero"
        recorded={3}
        total={27}
      />,
    );
    expect(zero.getByText('0 mg recorded')).toBeTruthy();

    const available = await render(
      <NutrientDataState
        metricName="Vitamin D"
        state="available"
        recorded={24}
        total={27}
      />,
    );
    expect(available.getByText('Recorded nutrient data')).toBeTruthy();
  });

  it('renders sparse coverage without converting gaps to zero', async () => {
    const screen = await render(
      <NutrientSparseState metricName="Vitamin D" recorded={12} total={27} />,
    );
    expect(screen.getByText('Sparse nutrient coverage')).toBeTruthy();
    expect(
      screen.getByText(
        'Vitamin D values were available on 12 of 27 logged days.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'The chart preserves gaps and avoids treating unknown values as zero.',
      ),
    ).toBeTruthy();
  });
});
