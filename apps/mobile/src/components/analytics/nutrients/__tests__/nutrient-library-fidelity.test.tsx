import type { ReportsResponse } from '@food-tracker/shared';
import { NutrientLibrary } from '../nutrient-library';
import { render, userEvent } from '@/test/render';

const report = {
  current: {
    goalDirection: 'lose',
    nutrientDetails: {
      vitaminC: {
        displayName: 'Vitamin C',
        category: 'vitamin',
        total: 96,
        averagePerLoggedDay: 96,
        unit: 'mg',
        recordedDayCount: 2,
        goal: {
          value: 90,
          unit: 'mg',
          direction: 'minimum',
          source: 'default',
        },
        periodGoal: 180,
        percentage: 106,
        status: 'meets_minimum',
      },
      vitaminD: {
        displayName: 'Vitamin D',
        category: 'vitamin',
        total: 12,
        averagePerLoggedDay: 12,
        unit: 'mcg',
        recordedDayCount: 1,
        goal: {
          value: 20,
          unit: 'mcg',
          direction: 'minimum',
          source: 'default',
        },
        periodGoal: 40,
        percentage: 60,
        status: 'below_minimum',
      },
    },
  },
} as unknown as ReportsResponse;

describe('nutrient library fidelity', () => {
  it('renders categories and keeps search results canonical', async () => {
    const onOpenMetric = jest.fn();
    const onOpenCategory = jest.fn();
    const screen = await render(
      <NutrientLibrary
        report={report}
        category={null}
        loading={false}
        error={null}
        onBack={jest.fn()}
        onRetry={jest.fn()}
        onOpenMetric={onOpenMetric}
        onOpenCategory={onOpenCategory}
      />,
    );

    expect(screen.getByText('Complete nutrient report')).toBeTruthy();
    expect(screen.getByText('CATEGORIES')).toBeTruthy();
    expect(screen.getByText('Vitamins')).toBeTruthy();

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Search nutrients' }));
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText('Search nutrients'), 'vit c');
    expect(screen.getByText('Vitamin C')).toBeTruthy();
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: /Vitamin C/ }));
    expect(onOpenMetric).toHaveBeenCalledWith('vitaminC');
  });

  it('renders canonical attention states and opens a selected category', async () => {
    const onOpenMetric = jest.fn();
    const onOpenCategory = jest.fn();
    const screen = await render(
      <NutrientLibrary
        report={report}
        category={null}
        loading={false}
        error={null}
        onBack={jest.fn()}
        onRetry={jest.fn()}
        onOpenMetric={onOpenMetric}
        onOpenCategory={onOpenCategory}
      />,
    );

    expect(screen.getByText('NEEDS ATTENTION')).toBeTruthy();
    expect(screen.getByText('Below minimum')).toBeTruthy();
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Open Vitamins category' }));
    expect(onOpenCategory).toHaveBeenCalledWith('vitamins');
  });
});
