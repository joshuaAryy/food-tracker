import { render, userEvent } from '@/test/render';
import { caloriesTrendFixture } from '@/test-fixtures/analytics-fixtures';
import { HydrationReport } from '../hydration-report';
import { LoggingConsistencyReport } from '../logging-consistency-report';
import { MacrosReport } from '../macros-report';
import { WeightReport } from '../weight-report';

const base = caloriesTrendFixture;

describe('metric-specific trend reports', () => {
  it('keeps Weight direction and custom controls authoritative and mode-scoped', async () => {
    const screen = await render(
      <WeightReport
        trend={{
          ...base,
          trackingMode: 'simple',
          primaryMetric: 'weight',
          reference: { kind: 'target', value: 130, unit: 'lb', source: 'user' },
          weightFacts: {
            current: 129.4,
            change: -1.7,
            direction: 'down',
            target: 130,
            goalPath: 'moving_toward',
          },
        }}
        width={390}
        simple
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
      />,
    );

    expect(screen.getByText('129.4 lb')).toBeTruthy();
    expect(screen.queryByText('Latest authoritative weight')).toBeNull();
    expect(screen.getByTestId('weight-chart-axis')).toBeTruthy();
    expect(screen.getByTestId('weight-trend-card').props.style).toEqual(
      expect.objectContaining({ minHeight: 372 }),
    );
    expect(screen.getByText('Goal 130 lb').props.className).toContain(
      'text-sage',
    );
    expect(JSON.stringify(screen.toJSON())).toContain(
      '"strokeDasharray":["2","3"]',
    );
    expect(screen.getByTestId('weight-trend-chart').props.style.height).toBe(
      190,
    );
    expect(screen.getByText('lb')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain('"opacity":0.16');
    expect(JSON.stringify(screen.toJSON())).toContain('"y1":95');
    expect(screen.getAllByText('130').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Your smoothed trend is moving gradually toward your goal.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Custom' })).toBeNull();
  });

  it('renders backend macro percentages without calculating them in the client', async () => {
    const screen = await render(
      <MacrosReport
        trend={{
          ...base,
          trackingMode: 'complex',
          primaryMetric: 'macroComposition',
          macroComposition: { protein: 120, carbs: 240, fat: 60 },
          macroPercentages: { protein: 24, carbs: 49, fat: 27 },
          macroAverageEnergy: 2184.4,
        }}
        width={390}
        simple={false}
        proteinTrend={base}
        proteinTrendLoading={false}
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('macro-legend-protein')).toBeTruthy();
    expect(screen.getByTestId('macro-legend-carbs')).toBeTruthy();
    expect(screen.getByTestId('macro-legend-fat')).toBeTruthy();
    expect(screen.getByText('2,184')).toBeTruthy();
    expect(screen.getByText('2,184').props).toEqual(
      expect.objectContaining({
        numberOfLines: 1,
        adjustsFontSizeToFit: true,
        className: expect.stringContaining('text-[20px]'),
      }),
    );
    expect(
      screen.getByTestId('macro-donut-svg').props.style.width,
    ).toBeGreaterThan(100);
    expect(screen.getByTestId('macro-donut-svg').props.style).toEqual(
      expect.objectContaining({
        shadowColor: '#7A9B76',
        shadowOpacity: expect.any(Number),
        shadowRadius: expect.any(Number),
      }),
    );
    expect(screen.getByTestId('macro-donut-halo')).toBeTruthy();
    expect(screen.getByText('Protein trend')).toBeTruthy();
    expect(screen.getByText(/Recorded value/)).toBeTruthy();
  });

  it('renders the Figma macro composition hierarchy and vertical daily mix', async () => {
    const screen = await render(
      <MacrosReport
        trend={{
          ...base,
          trackingMode: 'complex',
          primaryMetric: 'macroComposition',
          macroComposition: { protein: 120, carbs: 240, fat: 60 },
          macroPercentages: { protein: 24, carbs: 49, fat: 27 },
          macroAverageEnergy: 2184.4,
          macroDailyMix: [
            { date: '2026-08-01', protein: 24, carbs: 49, fat: 27 },
            { date: '2026-08-02', protein: 26, carbs: 45, fat: 29 },
          ],
        }}
        width={390}
        simple={false}
        proteinTrend={base}
        proteinTrendLoading={false}
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
      />,
    );

    expect(
      screen.getByText(
        'Protein remained the most consistent macro across logged days.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByTestId('macro-composition-card').props.className,
    ).toEqual(expect.stringContaining('min-h-[300px]'));
    expect(screen.getByTestId('macro-composition-card').props.style).toEqual(
      expect.objectContaining({ minHeight: 300 }),
    );
    expect(screen.getByTestId('macro-daily-mix-section')).toBeTruthy();
    expect(screen.getByTestId('macro-daily-mix-chart')).toBeTruthy();
    expect(
      screen.getAllByTestId('macro-daily-mix-bar')[0]!.props.style,
    ).toEqual(
      expect.objectContaining({
        shadowColor: '#7A9B76',
        shadowOpacity: expect.any(Number),
        shadowRadius: expect.any(Number),
      }),
    );
  });

  it('does not reserve a blank daily-mix chart when the backend has no daily series', async () => {
    const screen = await render(
      <MacrosReport
        trend={{
          ...base,
          trackingMode: 'complex',
          primaryMetric: 'macroComposition',
          macroComposition: { protein: 120, carbs: 240, fat: 60 },
          macroPercentages: { protein: 24, carbs: 49, fat: 27 },
          macroAverageEnergy: 2184.4,
          macroDailyMix: [],
        }}
        width={390}
        simple={false}
        proteinTrend={null}
        proteinTrendLoading={false}
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
      />,
    );

    expect(
      screen.getByText('Daily macro mix is unavailable for this period.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('macro-daily-mix-chart')).toBeNull();
  });

  it('keeps the hydration trend card at the approved Figma composition height', async () => {
    const points = Array.from({ length: 10 }, (_, index) => ({
      kind: 'daily' as const,
      date: `2026-08-${String(index + 1).padStart(2, '0')}`,
      value: 1500,
      metricDataState: 'recorded' as const,
      loggingDayState: 'complete' as const,
      loggingDayPhase: 'closed' as const,
      foodLogCount: 3,
      metricRecordedLogCount: 3,
      metricUnknownLogCount: 0,
    }));
    const screen = await render(
      <HydrationReport
        trend={{
          ...base,
          primaryMetric: 'hydration',
          reference: {
            kind: 'target',
            value: 2000,
            unit: 'mL',
            source: 'user',
          },
          summary: { ...base.summary, average: 1500, numericDayCount: 7 },
          points,
        }}
        width={390}
        onLogWater={jest.fn()}
      />,
    );

    expect(screen.getByTestId('hydration-trend-card').props.style).toEqual(
      expect.objectContaining({ minHeight: 382 }),
    );
    expect(
      screen.getByTestId('hydration-trend-x-labels').children,
    ).toHaveLength(7);
    expect(screen.getByText('Aug 4 – Aug 10')).toBeTruthy();
  });

  it('keeps the logging report readable with bounded week labels and coverage context', async () => {
    const screen = await render(
      <LoggingConsistencyReport
        trend={{
          ...base,
          trackingMode: 'simple',
          primaryMetric: 'loggingConsistency',
          loggingSummary: {
            complete: 21,
            partial: 3,
            unlogged: 3,
            inProgress: 1,
            consistency: 89.4,
            currentDayPhase: 'in_progress',
            mealCoverage: Array.from({ length: 7 }, (_, index) => ({
              date: `2026-08-${String(index + 1).padStart(2, '0')}`,
              breakfast: true,
              lunch: true,
              dinner: true,
              snack: false,
            })),
          },
        }}
        simple
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('logging-consistency-week-labels')).toBeTruthy();
    expect(
      screen.getByTestId('logging-consistency-daily-section-label'),
    ).toBeTruthy();
    expect(
      screen.getByTestId('logging-consistency-daily-card').props.style,
    ).toEqual(expect.objectContaining({ minHeight: 286 }));
    expect(
      screen.getByTestId('logging-consistency-meal-coverage'),
    ).toBeTruthy();
    expect(
      screen.getByTestId('logging-consistency-meal-card').props.style,
    ).toEqual(expect.objectContaining({ minHeight: 356 }));
    expect(
      screen.getByTestId('logging-consistency-meal-section-label'),
    ).toBeTruthy();
    expect(screen.getByText('PERIOD PATTERN')).toBeTruthy();
    expect(screen.getByText(/most recent 10 days contain/)).toBeTruthy();
    expect(screen.getByText(/24 logged days/)).toBeTruthy();
    expect(screen.getByText('89%')).toBeTruthy();
  });

  it('keeps Logging Consistency states and current phase from backend summary', async () => {
    const screen = await render(
      <LoggingConsistencyReport
        trend={{
          ...base,
          trackingMode: 'simple',
          primaryMetric: 'loggingConsistency',
          loggingSummary: {
            complete: 21,
            partial: 3,
            unlogged: 3,
            inProgress: 1,
            consistency: 89,
            currentDayPhase: 'in_progress',
            mealCoverage: [],
          },
        }}
        simple
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
      />,
    );

    expect(screen.getByText('89%')).toBeTruthy();
    expect(
      screen.queryByText('Complete 21 · Partial 3 · Unlogged 3'),
    ).toBeNull();
    expect(screen.getByText('DAILY COMPLETENESS')).toBeTruthy();
    expect(screen.getByText('Complete')).toBeTruthy();
    expect(screen.queryByText('How to read this')).toBeNull();
    expect(
      screen.getByTestId('logging-consistency-heatmap-grid').props.style.width,
    ).toBe(292);
    expect(JSON.stringify(screen.toJSON())).toContain('#76DBA0');
  });

  it('keeps Hydration water-only and exposes the canonical Log water action', async () => {
    const onLogWater = jest.fn();
    const screen = await render(
      <HydrationReport
        trend={{
          ...base,
          trackingMode: 'complex',
          primaryMetric: 'hydration',
          reference: {
            kind: 'target',
            value: 2000,
            unit: 'mL',
            source: 'default',
          },
          summary: { numericDayCount: 7, average: 1500 },
        }}
        width={390}
        onLogWater={onLogWater}
      />,
    );

    expect(
      screen.queryByText('Explicitly logged drinks only · Goal 2000 mL/day'),
    ).toBeNull();
    expect(screen.getByText('1.5 L')).toBeTruthy();
    expect(screen.getByText('2.0 L')).toBeTruthy();
    expect(screen.getByText('THIS WEEK')).toBeTruthy();
    expect(screen.getByTestId('hydration-trend-x-labels')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain('"height":190');
    expect(screen.queryByText('Water persistence')).toBeNull();
    const renderedHydrationChart = JSON.stringify(screen.toJSON());
    expect(renderedHydrationChart).toContain('"payload":4293325567');
    expect(renderedHydrationChart).toContain('"payload":4287477474');
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Log water' }));
    expect(onLogWater).toHaveBeenCalledTimes(1);
  });
});
