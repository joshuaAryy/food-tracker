import { render } from '@/test/render';
import { EnergyBalanceCard } from '../energy-balance-card';
import { HydrationInsightsCard } from '../hydration-insights-card';
import { LoggingConsistencyCard } from '../logging-consistency-card';
import { MacroBalanceCard } from '../macro-balance-card';
import { WeightDirectionCard } from '../weight-direction-card';

function complexPresentation<Props extends object>(props: Props): Props {
  return { ...props, presentation: 'complex' } as Props;
}

const fetchedAt = '2026-08-18T12:00:00.000Z';

describe('Complex Insights overview layout', () => {
  it('reserves the Figma reporting surfaces instead of collapsing to content height', async () => {
    const energy = await render(
      <EnergyBalanceCard
        {...complexPresentation({
          overview: {
            status: 'available' as const,
            fetchedAt,
            error: null,
            retryable: false,
            data: {
              average: 1846,
              numericDayCount: 6,
              reference: {
                kind: 'range' as const,
                lower: 1700,
                upper: 2200,
                unit: 'kcal' as const,
                source: 'user' as const,
              },
              withinRangeDayCount: 5,
              comparison: { direction: 'up' as const, percentage: 3 },
              status: 'within_range' as const,
            },
          },
          trend: undefined,
          onOpenTrend: jest.fn(),
          onRetry: jest.fn(),
        })}
      />,
    );
    expect(energy.getByTestId('energy-balance-card').props.style).toEqual(
      expect.objectContaining({ minHeight: 294 }),
    );

    const macro = await render(
      <MacroBalanceCard
        {...complexPresentation({
          overview: {
            status: 'available' as const,
            fetchedAt,
            error: null,
            retryable: false,
            data: {
              protein: { grams: 149, percentage: 24 },
              carbs: { grams: 269, percentage: 49 },
              fat: { grams: 49, percentage: 27 },
              status: 'recorded' as const,
            },
          },
          energyAverage: 2184,
          proteinTrend: undefined,
          onOpenTrend: jest.fn(),
          onRetry: jest.fn(),
        })}
      />,
    );
    expect(macro.getByTestId('macro-balance-card').props.style).toEqual(
      expect.objectContaining({ minHeight: 316 }),
    );

    const weight = await render(
      <WeightDirectionCard
        {...complexPresentation({
          overview: {
            status: 'available' as const,
            fetchedAt,
            error: null,
            retryable: false,
            data: {
              current: 129.4,
              availability: 'recorded' as const,
              change: {
                periodDays: 30,
                value: 1.7,
                direction: 'up' as const,
              },
              reference: {
                kind: 'target' as const,
                value: 130,
                unit: 'lb' as const,
                source: 'user' as const,
              },
              goalPathStatus: 'moving_toward' as const,
              forecast: {
                status: 'failed' as const,
                code: 'section_unavailable' as const,
                retryable: true as const,
              },
            },
          },
          trend: undefined,
          onOpenTrend: jest.fn(),
          onRetry: jest.fn(),
        })}
      />,
    );
    expect(weight.getByTestId('weight-direction-card').props.style).toEqual(
      expect.objectContaining({ minHeight: 250 }),
    );

    const logging = await render(
      <LoggingConsistencyCard
        {...complexPresentation({
          overview: {
            status: 'available' as const,
            fetchedAt,
            error: null,
            retryable: false,
            data: {
              completeDayCount: 1,
              partialDayCount: 1,
              unloggedDayCount: 1,
              inProgressDayCount: 1,
              eligibleLoggedDayCount: 2,
              eligibleTotalDayCount: 3,
              streak: { currentDays: 1, longestDays: 2 },
              days: [
                {
                  date: '2026-08-16',
                  loggingDayState: 'complete' as const,
                  loggingDayPhase: 'closed' as const,
                },
                {
                  date: '2026-08-17',
                  loggingDayState: 'partial' as const,
                  loggingDayPhase: 'closed' as const,
                },
                {
                  date: '2026-08-18',
                  loggingDayState: 'unlogged' as const,
                  loggingDayPhase: 'in_progress' as const,
                },
              ],
            },
          },
          onRetry: jest.fn(),
        })}
      />,
    );
    expect(logging.getByTestId('logging-consistency-card').props.style).toEqual(
      expect.objectContaining({ minHeight: 260 }),
    );
    expect(
      logging.getByTestId('logging-consistency-heatmap-grid').props.style,
    ).toEqual(expect.objectContaining({ width: 162 }));
  });

  it('uses the Figma hydration vessel footprint without changing logged totals', async () => {
    const screen = await render(
      <HydrationInsightsCard
        {...complexPresentation({
          overview: {
            status: 'available' as const,
            fetchedAt,
            error: null,
            retryable: false,
            data: {
              today: '2026-08-18',
              timezone: 'America/Toronto',
              total: 1630,
              goal: 2000,
              status: 'below_goal' as const,
              trendSection: 'hydration' as const,
            },
          },
          trend: undefined,
          onLogWater: jest.fn(),
          onOpenTrend: jest.fn(),
          onRetry: jest.fn(),
        })}
      />,
    );

    expect(screen.getByTestId('hydration-insights-card').props.style).toEqual(
      expect.objectContaining({ minHeight: 248 }),
    );
    expect(
      screen.getByTestId('hydration-vessel-row').props.className,
    ).toContain('gap-5');
    expect(screen.getByTestId('hydration-vessel-visual-0').props.style).toEqual(
      { transform: [{ scaleX: 26 / 18 }, { scaleY: 36 / 32 }] },
    );
    expect(screen.getByText('1.6 L')).toBeTruthy();
  });
});
