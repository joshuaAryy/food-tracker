import { describe, expect, it } from 'vitest';
import {
  selectedIndexForScrubX,
  selectionForSharedDate,
  shouldAnnounceSelectionChange,
} from './chart-interaction';

describe('analytics chart interaction', () => {
  it('selects the nearest underlying date while clamping a scrub position', () => {
    expect(selectedIndexForScrubX(-4, 4, 300)).toBe(0);
    expect(selectedIndexForScrubX(151, 4, 300)).toBe(2);
    expect(selectedIndexForScrubX(500, 4, 300)).toBe(3);
    expect(selectedIndexForScrubX(20, 0, 300)).toBeNull();
  });

  it('shares one selected date without turning a missing second value into zero', () => {
    expect(
      selectionForSharedDate(
        [
          { date: '2026-08-01', value: 100 },
          { date: '2026-08-02', value: 120 },
        ],
        [
          { date: '2026-08-01', value: 70 },
          { date: '2026-08-02', value: null },
        ],
        '2026-08-02',
      ),
    ).toEqual({ date: '2026-08-02', primaryValue: 120, comparisonValue: null });
  });

  it('announces a scrub selection only when the selected underlying day changes', () => {
    expect(shouldAnnounceSelectionChange(null, 0)).toBe(true);
    expect(shouldAnnounceSelectionChange(1, 1)).toBe(false);
    expect(shouldAnnounceSelectionChange(1, 2)).toBe(true);
  });
});
