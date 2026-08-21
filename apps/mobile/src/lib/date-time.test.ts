import { describe, expect, it } from 'vitest';
import {
  formatPresentationDate,
  formatPresentationDateRange,
} from './date-time';

describe('presentation date formatting', () => {
  it('formats a date-only value without a UTC day shift', () => {
    expect(formatPresentationDate('2026-08-07')).toBe('Aug 7');
    expect(formatPresentationDate('2026-08-07', { includeYear: true })).toBe(
      'Aug 7, 2026',
    );
  });

  it('formats a date-only range for human-readable product copy', () => {
    expect(formatPresentationDateRange('2026-07-06', '2026-08-04')).toBe(
      'Jul 6 – Aug 4',
    );
    expect(formatPresentationDateRange('2026-08-07', '2026-08-07')).toBe(
      'Aug 7',
    );
  });
});
