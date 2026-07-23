import { describe, expect, it } from 'vitest';
import {
  calculateConsistency,
  calculateStreak,
  type ReportingDay,
} from '../src/modules/analytics/reporting/facts.js';

const day = (date: string, logged = true): ReportingDay => ({ date, logged });

describe('reporting streak and consistency facts', () => {
  it('counts actual logged days for the headline and uses one grace day only for span', () => {
    expect(
      calculateStreak(
        [day('2026-07-10'), day('2026-07-11'), day('2026-07-13')],
        '2026-07-13',
      ),
    ).toMatchObject({
      currentLoggedDays: 3,
      currentSpanDays: 4,
      graceUsed: true,
      graceDate: '2026-07-12',
      longestLoggedDays: 3,
      todayLogged: true,
    });
  });

  it('keeps yesterday active while today is still open and breaks after a second miss', () => {
    expect(calculateStreak([day('2026-07-11')], '2026-07-12')).toMatchObject({
      currentLoggedDays: 1,
      currentSpanDays: 1,
      graceUsed: false,
      todayLogged: false,
      todayOpen: true,
    });

    expect(calculateStreak([day('2026-07-08')], '2026-07-12')).toMatchObject({
      currentLoggedDays: 0,
      currentSpanDays: 0,
      graceUsed: false,
      todayOpen: true,
    });
  });

  it('excludes future logs without changing the current or longest streak', () => {
    const withoutFuture = calculateStreak(
      [day('2026-07-10'), day('2026-07-11')],
      '2026-07-12',
    );
    const withFuture = calculateStreak(
      [day('2026-07-10'), day('2026-07-11'), day('2026-07-20')],
      '2026-07-12',
    );

    expect(withFuture).toEqual(withoutFuture);
  });

  it('restores grace for a newly started streak and does not let grace win longest', () => {
    expect(
      calculateStreak(
        [day('2026-07-01'), day('2026-07-03'), day('2026-07-10')],
        '2026-07-10',
      ),
    ).toMatchObject({
      currentLoggedDays: 1,
      graceUsed: false,
      longestLoggedDays: 2,
    });
  });

  it('calculates eligible consistency from the first logged day only', () => {
    expect(
      calculateConsistency(
        [
          day('2026-07-01', false),
          day('2026-07-02', true),
          day('2026-07-03', false),
        ],
        { startDate: '2026-06-28', endDate: '2026-07-05' },
      ),
    ).toEqual({ eligibleDays: 2, loggedDays: 1, percentage: 50 });
  });
});
