import { render, userEvent } from '../../test/render';
import {
  ProgressCalorieHero,
  ProgressReportingSummary,
} from '../progress-reporting-summary';

describe('Progress reporting Trend entrypoints', () => {
  it('opens Calories Trends from the energy hero', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <ProgressCalorieHero
        summary={
          {
            caloriesConsumed: 1200,
            caloriesRemaining: 800,
            calorieTarget: 2000,
          } as never
        }
        weeklyReport={null}
        onPress={onPress}
      />,
    );

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Open Calories Trend' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes Momentum, nutrient, and full-report callbacks without changing Progress facts', async () => {
    const onReports = jest.fn();
    const onWeeklyMomentum = jest.fn();
    const onNutrientPress = jest.fn();
    const screen = await render(
      <ProgressReportingSummary
        reporting={{ consistency7Days: { available: false } } as never}
        weeklyReport={null}
        dailyNutrients={
          {
            nutrients: { protein: { amount: 42, unit: 'g' } },
            reportingGoals: {},
            percentages: {},
          } as never
        }
        weeklyReportError={null}
        dailyNutrientsError={null}
        onRetry={jest.fn()}
        onReports={onReports}
        onWeeklyMomentum={onWeeklyMomentum}
        onNutrientPress={onNutrientPress}
      />,
    );
    const user = userEvent.setup();

    await user.press(
      screen.getByRole('button', { name: 'Open Logging Consistency Trend' }),
    );
    await user.press(
      screen.getByRole('button', { name: 'Open protein Trend' }),
    );
    await user.press(
      screen.getByRole('button', {
        name: 'Open detailed reports in Insights',
      }),
    );

    expect(onWeeklyMomentum).toHaveBeenCalledTimes(1);
    expect(onNutrientPress).toHaveBeenCalledWith('protein');
    expect(onReports).toHaveBeenCalledTimes(1);
  });
});
