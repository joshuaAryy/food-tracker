import { render } from '../../../test/render';
import { AnalyticsOfflineBanner } from '../../../components/analytics/states/analytics-offline-banner';
import { AnalyticsReportUnavailable } from '../../../components/analytics/states/analytics-report-unavailable';
import { AnalyticsSectionError } from '../../../components/analytics/insights/analytics-section-error';

describe('Insights diagnostics visibility', () => {
  it('keeps success-adjacent cached and section state copy free of internal diagnostics', async () => {
    const screen = await render(
      <>
        <AnalyticsOfflineBanner cachedAt={Date.parse('2026-08-11T12:00:00Z')} />
        <AnalyticsSectionError
          title="Hydration"
          section={undefined}
          onRetry={jest.fn()}
        />
      </>,
    );

    expect(screen.getByText('Offline · Showing saved analytics')).toBeTruthy();
    expect(screen.getByText(/Hydration/)).toBeTruthy();
    expect(screen.getByLabelText('Retry hydration')).toBeTruthy();
    expect(screen.queryByText(/Diagnostic:/)).toBeNull();
    expect(
      screen.queryByText(/2xx|5xx|request|cache yes|parser|reducer/i),
    ).toBeNull();
  });

  it('keeps the full report unavailable state user-safe and retryable', async () => {
    const onRetry = jest.fn();
    const screen = await render(
      <AnalyticsReportUnavailable period="week" onRetry={onRetry} />,
    );

    expect(screen.getByText('Analytics unavailable')).toBeTruthy();
    expect(screen.getByLabelText('Retry analytics')).toBeTruthy();
    expect(screen.queryByText(/Diagnostic:/)).toBeNull();
    expect(
      screen.queryByText(/HTTP|request ID|cache|parser|reducer/i),
    ).toBeNull();
  });
});
