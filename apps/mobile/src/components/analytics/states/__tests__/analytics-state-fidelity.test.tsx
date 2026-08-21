import { render, userEvent } from '@/test/render';
import { AnalyticsFirstUse } from '../analytics-first-use';
import { AnalyticsOfflineBanner } from '../analytics-offline-banner';
import { AnalyticsReportUnavailable } from '../analytics-report-unavailable';
import { AnalyticsSkeleton } from '../analytics-skeleton';

describe('analytics state fidelity', () => {
  it('renders the exact safe loading composition without report internals', async () => {
    const screen = await render(<AnalyticsSkeleton period="month" />);
    expect(screen.getByTestId('analytics-skeleton')).toBeTruthy();
    expect(screen.getByText('Month · Loading analytics')).toBeTruthy();
    expect(screen.queryByText(/Diagnostic:/)).toBeNull();
  });

  it('keeps first-use totals and unlock progress separate from trend access', async () => {
    const onExplore = jest.fn();
    const screen = await render(
      <AnalyticsFirstUse
        mealCount={1}
        calories={612}
        proteinGrams={38}
        loggedDays={2}
        requiredDays={7}
        currentDayPhase="in_progress"
        onExplore={onExplore}
      />,
    );
    expect(screen.getByText('Today so far')).toBeTruthy();
    expect(screen.getByText('1 meal')).toBeTruthy();
    expect(screen.getByText('Keep logging to unlock trends')).toBeTruthy();
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Explore all trends' }));
    expect(onExplore).toHaveBeenCalledTimes(1);
  });

  it('renders report-level recovery copy and offline committed-data state', async () => {
    const onRetry = jest.fn();
    const unavailable = await render(
      <AnalyticsReportUnavailable period="month" onRetry={onRetry} />,
    );
    expect(unavailable.getByText('Analytics unavailable')).toBeTruthy();
    await userEvent
      .setup()
      .press(unavailable.getByRole('button', { name: 'Retry analytics' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    const offline = await render(
      <AnalyticsOfflineBanner cachedAt={Date.parse('2026-08-05T20:12:00Z')} />,
    );
    expect(offline.getByText('Offline · Showing saved analytics')).toBeTruthy();
    expect(offline.queryByText(/request|cache state|HTTP/i)).toBeNull();
  });
});
