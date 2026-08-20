import type {
  AnalyticsDailyPoint,
  AnalyticsContributorsResponse,
  CanonicalTrendResponse,
} from '@food-tracker/shared';
import { render } from '@/test/render';
import { VitaminCDetailReport } from '../vitamin-c-detail-report';

const trend: CanonicalTrendResponse = {
  timezone: 'America/Toronto',
  trackingMode: 'complex',
  primaryMetric: 'vitaminC',
  aggregation: 'daily',
  resolvedRange: { startDate: '2026-07-06', endDate: '2026-08-04' },
  firstEligibleDate: '2026-07-01',
  today: '2026-08-04',
  reference: {
    kind: 'range',
    lower: 75,
    upper: 120,
    unit: 'mg',
    source: 'user',
  },
  interpretation: {
    kind: 'within_range',
    message: 'Recorded average is within the configured range.',
  },
  relatedMetrics: ['iron'],
  points: [
    {
      kind: 'daily',
      date: '2026-08-04',
      loggingDayState: 'complete',
      loggingDayPhase: 'closed',
      metricDataState: 'recorded',
      value: 96,
      foodLogCount: 2,
      metricRecordedLogCount: 2,
      metricUnknownLogCount: 0,
    },
  ],
  summary: { numericDayCount: 24, average: 96 },
  metricDataSummary: {
    recorded: 24,
    partial: 1,
    unknown: 5,
    state: 'available',
  },
};

const contributors: AnalyticsContributorsResponse = {
  metric: 'vitaminC',
  resolvedRange: trend.resolvedRange,
  recordedTotal: 2592,
  contributors: [{ foodName: 'Orange', value: 544, percentage: 0.21 }],
  remainder: null,
  hasMore: false,
};

describe('Vitamin C detail report fidelity', () => {
  it('uses the configured-range composition and presentation-only formatting', async () => {
    const screen = await render(
      <VitaminCDetailReport
        trend={{
          ...trend,
          points: [
            {
              kind: 'daily',
              date: '2026-08-03',
              loggingDayState: 'complete',
              loggingDayPhase: 'closed',
              metricDataState: 'recorded',
              value: 88,
              foodLogCount: 2,
              metricRecordedLogCount: 2,
              metricUnknownLogCount: 0,
            },
            trend.points[0]!,
          ],
        }}
        relatedName="Iron"
        relatedTrend={null}
        relatedError={null}
        contributors={contributors}
        width={390}
        simple={false}
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
        onOpenRelated={jest.fn()}
        onOpenContributors={jest.fn()}
      />,
    );

    expect(screen.getByTestId('vitamin-c-detail-report')).toBeTruthy();
    expect(screen.getByText('96 mg')).toEqual(
      expect.objectContaining({
        props: expect.objectContaining({
          className: expect.stringContaining('text-[32px]'),
        }),
      }),
    );
    expect(screen.getByText('average · inside your range')).toBeTruthy();
    expect(screen.getByText('Custom range')).toBeTruthy();
    expect(screen.getByTestId('vitamin-c-chart-card').props.style).toEqual(
      expect.objectContaining({ minHeight: 372 }),
    );
    expect(screen.getByText('75–120 mg')).toBeTruthy();
    expect(screen.getByRole('button', { name: '30D' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Custom' })).toBeTruthy();
    expect(screen.getAllByText(/24 recorded days/)).toHaveLength(1);
    expect(screen.getByText('Top contributors')).toBeTruthy();
    expect(screen.getByTestId('vitamin-c-bar-trend')).toBeTruthy();
    expect(screen.getByTestId('vitamin-c-chart-card')).toBeTruthy();
    expect(screen.queryByText('Vitamin C trend')).toBeNull();
    expect(screen.getByText(/Recorded metric/)).toBeTruthy();
    expect(screen.getByText(/Complete day/)).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain('"r":6');
    expect(JSON.stringify(screen.toJSON())).toContain('"payload":4286941849');
    expect(JSON.stringify(screen.toJSON())).toContain('"payload":4292007905');
    expect(JSON.stringify(screen.toJSON())).toContain(
      '"stroke":{"type":0,"payload":4291087319}',
    );
  });

  it('keeps the related metric card renderable when its trend is available', async () => {
    const screen = await render(
      <VitaminCDetailReport
        trend={trend}
        relatedName="Iron"
        relatedTrend={{ ...trend, primaryMetric: 'iron' }}
        relatedError={null}
        contributors={contributors}
        width={390}
        simple={false}
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
        onOpenRelated={jest.fn()}
        onOpenContributors={jest.fn()}
      />,
    );

    expect(screen.getByText('96 mg average')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Open Iron paired view' }),
    ).toBeTruthy();
  });

  it('separates the recorded-period summary from the chart and keeps paired context concise', async () => {
    const screen = await render(
      <VitaminCDetailReport
        trend={trend}
        relatedName="Iron"
        relatedTrend={{
          ...trend,
          primaryMetric: 'iron',
          reference: {
            kind: 'minimum',
            value: 8,
            unit: 'mg',
            source: 'default',
          },
        }}
        relatedError={null}
        contributors={contributors}
        width={390}
        simple={false}
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
        onOpenRelated={jest.fn()}
        onOpenContributors={jest.fn()}
      />,
    );

    expect(
      screen.getByText(
        'Average across 24 recorded days is inside your configured range.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'This describes the recorded period only; it does not infer a health outcome.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Related metric')).toBeTruthy();
    expect(screen.queryByText('Minimum · at least 8 mg')).toBeNull();
  });

  it('presents the selected raw observation with a human date and its distinct metric and logging states', async () => {
    const partialInProgressPoint: AnalyticsDailyPoint = {
      kind: 'daily',
      date: '2026-08-04',
      loggingDayState: 'partial',
      loggingDayPhase: 'in_progress',
      metricDataState: 'partial',
      value: 124.4857142857143,
      foodLogCount: 2,
      metricRecordedLogCount: 2,
      metricUnknownLogCount: 0,
    };
    const screen = await render(
      <VitaminCDetailReport
        trend={{
          ...trend,
          points: [partialInProgressPoint],
        }}
        relatedName="Iron"
        relatedTrend={null}
        relatedError={null}
        contributors={contributors}
        width={390}
        simple={false}
        selectedPeriod={30}
        onSelectPeriod={jest.fn()}
        onOpenCustomRange={jest.fn()}
        onOpenRelated={jest.fn()}
        onOpenContributors={jest.fn()}
      />,
    );

    expect(screen.getAllByText('Aug 4').length).toBeGreaterThan(0);
    expect(
      screen.getByText('124.5 mg · Partial metric · In progress'),
    ).toBeTruthy();
    expect(screen.queryByText('2026-08-04')).toBeNull();
    expect(screen.queryByText('124.4857142857143 mg')).toBeNull();
  });
});
