import {
  analyticsReportResourceReducer,
  initialAnalyticsReportResource,
} from '@/lib/analytics/analytics-report-resource';
import { adaptCanonicalInsightsResponseV1 } from '@/lib/analytics/analytics-v1-adapter';
import { simpleInsightsFixture } from '@/test-fixtures/analytics-fixtures';
import { render, userEvent } from '@/test/render';
import { SimpleInsightsOverview } from '../simple-insights-overview';

const fetchedAt = '2026-08-11T12:00:00.000Z';

function readySimpleResource() {
  const report = adaptCanonicalInsightsResponseV1(
    simpleInsightsFixture,
    fetchedAt,
  );
  if (report === null) throw new Error('Expected validated Simple v1 adapter');
  return analyticsReportResourceReducer(
    analyticsReportResourceReducer(initialAnalyticsReportResource(), {
      type: 'load',
      requestId: 1,
    }),
    { type: 'commit', requestId: 1, report, updatedAt: 1 },
  );
}

function resourceWithUnavailableWeight() {
  const report = adaptCanonicalInsightsResponseV1(
    simpleInsightsFixture,
    fetchedAt,
  );
  if (report === null) throw new Error('Expected validated Simple v1 adapter');
  const sections = { ...report.sections };
  delete sections.weight;
  return analyticsReportResourceReducer(
    analyticsReportResourceReducer(initialAnalyticsReportResource(), {
      type: 'load',
      requestId: 1,
    }),
    {
      type: 'commit',
      requestId: 1,
      report: { ...report, sections },
      updatedAt: 1,
    },
  );
}

describe('Simple Insights overview fidelity', () => {
  it('renders the approved Simple reporting hierarchy from canonical section facts', async () => {
    const screen = await render(
      <SimpleInsightsOverview
        resource={readySimpleResource()}
        onExploreTrends={jest.fn()}
        onLogWater={jest.fn()}
        onSectionRetry={jest.fn()}
      />,
    );

    expect(
      screen
        .getAllByTestId(/simple-insights-section-/)
        .map((node) => node.props.testID),
    ).toEqual([
      'simple-insights-section-period-summary',
      'simple-insights-section-energy-balance',
      'simple-insights-section-macro-balance',
      'simple-insights-section-nutrient-highlights',
      'simple-insights-section-hydration',
      'simple-insights-section-weight-direction',
      'simple-insights-section-logging-consistency',
    ]);
    expect(screen.getByText('This month')).toBeTruthy();
    expect(screen.getByText('1,846 kcal')).toBeTruthy();
    expect(screen.getByText('Protein · 149 g')).toBeTruthy();
    expect(screen.getByText('1.63 L')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Explore all trends' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log water' })).toBeTruthy();
  });

  it('uses the approved callbacks and keeps Complex-only actions absent', async () => {
    const onExploreTrends = jest.fn();
    const onLogWater = jest.fn();
    const screen = await render(
      <SimpleInsightsOverview
        resource={readySimpleResource()}
        onExploreTrends={onExploreTrends}
        onLogWater={onLogWater}
        onSectionRetry={jest.fn()}
      />,
    );

    const user = userEvent.setup();
    await user.press(
      screen.getByRole('button', { name: 'Explore all trends' }),
    );
    await user.press(screen.getByRole('button', { name: 'Log water' }));

    expect(onExploreTrends).toHaveBeenCalledTimes(1);
    expect(onLogWater).toHaveBeenCalledTimes(1);
    for (const action of [
      'Custom Range',
      'Saved views',
      'Compare metrics',
      'Configure',
      'Nutrient library',
    ]) {
      expect(screen.queryByText(action)).toBeNull();
    }
  });

  it('isolates a failed section and keeps committed siblings mounted through its retry', async () => {
    const retrying = analyticsReportResourceReducer(
      resourceWithUnavailableWeight(),
      {
        type: 'sectionRetry',
        requestId: 2,
        section: 'weight',
      },
    );
    const onSectionRetry = jest.fn();
    const screen = await render(
      <SimpleInsightsOverview
        resource={retrying}
        onExploreTrends={jest.fn()}
        onLogWater={jest.fn()}
        onSectionRetry={onSectionRetry}
      />,
    );

    expect(screen.getByText('1,846 kcal')).toBeTruthy();
    expect(screen.getByText('Weight couldn’t load')).toBeTruthy();
    expect(screen.getByText('Retrying weight…')).toBeTruthy();
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Retry weight' }));
    expect(onSectionRetry).toHaveBeenCalledWith('weight');
  });
});
