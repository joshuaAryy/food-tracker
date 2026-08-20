import { render, userEvent } from '@/test/render';
import {
  LoggingConsistencyCard,
  loggingConsistencyPreviewLayout,
} from '../logging-consistency-card';

const fetchedAt = '2026-08-20T12:00:00.000Z';

describe('LoggingConsistencyCard', () => {
  it('keeps complete, partial, and in-progress logging days distinct in the enlarged Complex preview', async () => {
    const screen = await render(
      <LoggingConsistencyCard
        presentation="complex"
        overview={{
          status: 'available',
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
                loggingDayState: 'complete',
                loggingDayPhase: 'closed',
              },
              {
                date: '2026-08-17',
                loggingDayState: 'partial',
                loggingDayPhase: 'closed',
              },
              {
                date: '2026-08-18',
                loggingDayState: 'unlogged',
                loggingDayPhase: 'in_progress',
              },
            ],
          },
        }}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Aug 16: complete')).toBeTruthy();
    expect(screen.getByLabelText('Aug 17: partial')).toBeTruthy();
    expect(screen.getByLabelText('Aug 18: in_progress')).toBeTruthy();
    expect(screen.getByText(/Current day remains in progress/)).toBeTruthy();
  });

  it('keeps the enlarged preview inside the content width on a 320pt phone', () => {
    expect(loggingConsistencyPreviewLayout(390)).toEqual({
      columns: 10,
      cellSize: 22,
      cellGap: 8,
      width: 292,
    });
    expect(loggingConsistencyPreviewLayout(320)).toEqual({
      columns: 10,
      cellSize: 17,
      cellGap: 8,
      width: 242,
    });
  });

  it('uses a balanced single-row layout for a current-week preview', () => {
    expect(loggingConsistencyPreviewLayout(390, 7)).toEqual({
      columns: 7,
      cellSize: 28,
      cellGap: 8,
      width: 244,
    });
  });

  it('keeps the section-scoped retry callback for unavailable logging data', async () => {
    const onRetry = jest.fn();
    const screen = await render(
      <LoggingConsistencyCard
        overview={{
          status: 'unavailable',
          fetchedAt: null,
          error: 'Unavailable',
          retryable: true,
          data: null,
        }}
        onRetry={onRetry}
      />,
    );

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Retry logging consistency' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
