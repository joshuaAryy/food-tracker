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
            recordedDayCount: 18,
            eligibleDayCount: 30,
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
    expect(JSON.stringify(screen.toJSON())).toContain('"payload":4286093174');
    expect(JSON.stringify(screen.toJSON())).toContain('"opacity":0.16');
    expect(JSON.stringify(screen.toJSON())).toContain('"y1":95');
    expect(screen.getAllByText('130').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Your smoothed trend is moving gradually toward your goal.',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('weight-weigh-in-coverage')).toBeTruthy();
    expect(screen.getAllByTestId('weight-weigh-in-cell')).toHaveLength(20);
    expect(screen.getByText('18 weigh-ins across 30 days')).toBeTruthy();
    expect(screen.getByTestId('weight-display-card').props.style).toEqual(
      expect.objectContaining({ minHeight: 142 }),
    );
    expect(screen.getByText('Raw points visible')).toBeTruthy();
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
    expect(screen.getByTestId('macro-composition-layout').props.style).toEqual(
      expect.objectContaining({ width: 156 }),
    );
    expect(screen.getByTestId('macro-protein-trend-card').props.style).toEqual(
      expect.objectContaining({ minHeight: 226 }),
    );
    expect(screen.getByText('Protein trend')).toBeTruthy();
    expect(screen.getByText(/Recorded value/)).toBeTruthy();
  });

  it('presents macro percentages as whole values without changing backend facts', async () => {
    const screen = await render(
      <MacrosReport
        trend={{
          ...base,
          trackingMode: 'complex',
          primaryMetric: 'macroComposition',
          macroComposition: { protein: 120, carbs: 240, fat: 60 },
          macroPercentages: { protein: 26.5, carbs: 42.7, fat: 30.8 },
          macroAverageEnergy: 1945.4,
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

    expect(screen.getByText('27%')).toBeTruthy();
    expect(screen.getByText('43%')).toBeTruthy();
    expect(screen.getByText('31%')).toBeTruthy();
    expect(screen.queryByText('26.5%')).toBeNull();
    expect(screen.queryByText('42.7%')).toBeNull();
    expect(screen.queryByText('30.8%')).toBeNull();
  });

  it('keeps the Protein trend reference range visible in the detailed report', async () => {
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
        proteinTrend={{
          ...base,
          primaryMetric: 'protein',
          reference: {
            kind: 'range',
            lower: 110,
            upper: 150,
            unit: 'g',
            source: 'user',
          },
          rollingTrend: {
            window: 7,
            values: base.points.map((point) => point.value),
          },
        }}
        proteinTrendLoading={false}
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
      />,
    );

    expect(JSON.stringify(screen.toJSON())).toContain('RNSVGLinearGradient');
    expect(JSON.stringify(screen.toJSON())).toContain('"height":112');
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
    const recentCoveragePoints = Array.from({ length: 10 }, (_, index) => {
      const isPartial = index === 7;
      const isUnlogged = index >= 8;
      return {
        kind: 'daily' as const,
        date: `2026-08-${String(index + 1).padStart(2, '0')}`,
        loggingDayState: isUnlogged
          ? ('unlogged' as const)
          : isPartial
            ? ('partial' as const)
            : ('complete' as const),
        loggingDayPhase: 'closed' as const,
        metricDataState: isUnlogged
          ? null
          : isPartial
            ? ('partial' as const)
            : ('recorded' as const),
        value: isUnlogged ? null : 1000,
        foodLogCount: isUnlogged ? 0 : 1,
        metricRecordedLogCount: isUnlogged ? 0 : 1,
        metricUnknownLogCount: 0,
      };
    });
    const screen = await render(
      <LoggingConsistencyReport
        trend={{
          ...base,
          trackingMode: 'simple',
          primaryMetric: 'loggingConsistency',
          points: recentCoveragePoints,
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
    ).toEqual(expect.objectContaining({ minHeight: 284 }));
    expect(
      screen.getByTestId('logging-consistency-meal-coverage'),
    ).toBeTruthy();
    expect(
      screen.getByTestId('logging-consistency-meal-card').props.style,
    ).toEqual(expect.objectContaining({ minHeight: 354 }));
    expect(
      screen.getByTestId('logging-consistency-meal-section-label'),
    ).toBeTruthy();
    expect(screen.getByText('PERIOD PATTERN')).toBeTruthy();
    expect(screen.getByText(/most recent 10 days contain/)).toBeTruthy();
    const recentSummary = screen.getByText(/most recent 10 days contain/);
    expect(recentSummary.props.children.at(-2)).toBe('days');
    expect(screen.getByText('24 of 28 elapsed days logged')).toBeTruthy();
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
        onOpenWaterLogger={jest.fn()}
      />,
    );

    expect(
      screen.queryByText('Explicitly logged drinks only · Goal 2000 mL/day'),
    ).toBeNull();
    expect(screen.getByText('1.5 L')).toBeTruthy();
    expect(screen.getByText('2.0 L')).toBeTruthy();
    expect(screen.getByText('THIS WEEK')).toBeTruthy();
    expect(screen.getByTestId('hydration-trend-x-labels')).toBeTruthy();
    expect(
      screen.getByTestId('hydration-trend-card').props.className,
    ).toContain('rounded-[18px]');
    expect(screen.getByTestId('hydration-target-actions')).toBeTruthy();
    expect(
      screen.getByTestId('hydration-target-other-amount').props.className,
    ).toContain('bg-[#F7F7F4]');
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
