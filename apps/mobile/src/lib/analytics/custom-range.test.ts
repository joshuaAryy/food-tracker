import { describe, expect, it } from 'vitest';
import {
  clampRailViewport,
  customRangeAggregationLabel,
  dateForRailPosition,
  moveCustomRangeHandle,
  normalizeCustomRange,
  panSelectedRange,
  panRailViewport,
  railPositionForDate,
  rangeShortcut,
  selectCustomRangeEndpoint,
  shouldEmitRangeHandleHaptic,
  zoomRailViewport,
  zoomSelectedRange,
} from './custom-range';

describe('Custom Range', () => {
  it('clamps selections to the first eligible day through today and preserves inclusive order', () => {
    expect(
      normalizeCustomRange({
        startDate: '2026-07-01',
        endDate: '2026-08-20',
        firstEligibleDate: '2026-07-10',
        today: '2026-08-08',
      }),
    ).toEqual({ startDate: '2026-07-10', endDate: '2026-08-08', days: 30 });
  });

  it('uses approved automatic aggregation thresholds', () => {
    expect(customRangeAggregationLabel(45)).toBe('Daily');
    expect(customRangeAggregationLabel(46)).toBe('Weekly');
    expect(customRangeAggregationLabel(181)).toBe('Monthly');
  });

  it('maps rail positions to eligible whole days and clamps both ends', () => {
    expect(
      railPositionForDate({
        date: '2026-07-15',
        firstEligibleDate: '2026-07-10',
        today: '2026-07-20',
      }),
    ).toBe(0.5);
    expect(
      dateForRailPosition({
        position: 1.2,
        firstEligibleDate: '2026-07-10',
        today: '2026-07-20',
      }),
    ).toBe('2026-07-20');
  });

  it('snaps interactive handles to days without allowing them to cross', () => {
    expect(
      moveCustomRangeHandle({
        handle: 'start',
        proposedDate: '2026-08-10',
        startDate: '2026-08-03',
        endDate: '2026-08-08',
        firstEligibleDate: '2026-08-01',
        today: '2026-08-20',
      }),
    ).toEqual({ startDate: '2026-08-08', endDate: '2026-08-08', days: 1 });
    expect(
      selectCustomRangeEndpoint({
        endpoint: 'end',
        proposedDate: '2026-08-01',
        startDate: '2026-08-03',
        endDate: '2026-08-08',
        firstEligibleDate: '2026-08-01',
        today: '2026-08-20',
      }),
    ).toEqual({ startDate: '2026-08-03', endDate: '2026-08-03', days: 1 });
  });

  it('provides clamped relative shortcuts from today', () => {
    expect(
      rangeShortcut({
        days: 7,
        firstEligibleDate: '2026-08-01',
        today: '2026-08-08',
      }),
    ).toEqual({ startDate: '2026-08-02', endDate: '2026-08-08', days: 7 });
    expect(
      rangeShortcut({
        days: 30,
        firstEligibleDate: '2026-08-01',
        today: '2026-08-08',
      }),
    ).toEqual({ startDate: '2026-08-01', endDate: '2026-08-08', days: 8 });
  });

  it('keeps viewport pan and zoom within eligible rail bounds', () => {
    const viewport = clampRailViewport({
      startDate: '2026-08-03',
      endDate: '2026-08-08',
      firstEligibleDate: '2026-08-01',
      today: '2026-08-20',
    });
    expect(
      panRailViewport({
        viewport,
        deltaDays: -10,
        firstEligibleDate: '2026-08-01',
        today: '2026-08-20',
      }),
    ).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-06',
    });
    expect(
      zoomRailViewport({
        viewport,
        factor: 0.1,
        focalDate: '2026-08-05',
        firstEligibleDate: '2026-08-01',
        today: '2026-08-20',
      }),
    ).toEqual({
      startDate: '2026-08-05',
      endDate: '2026-08-05',
    });
  });

  it('pans the selected range as one unit without changing its inclusive span', () => {
    const selection = {
      startDate: '2026-08-03',
      endDate: '2026-08-08',
      days: 6,
    };
    expect(
      panSelectedRange({
        selection,
        deltaDays: -10,
        firstEligibleDate: '2026-08-01',
        today: '2026-08-20',
      }),
    ).toEqual({ startDate: '2026-08-01', endDate: '2026-08-06', days: 6 });
    expect(
      panSelectedRange({
        selection,
        deltaDays: 20,
        firstEligibleDate: '2026-08-01',
        today: '2026-08-20',
      }),
    ).toEqual({ startDate: '2026-08-15', endDate: '2026-08-20', days: 6 });
  });

  it('zooms the selected range around a focal day while preserving bounds', () => {
    expect(
      zoomSelectedRange({
        selection: {
          startDate: '2026-08-01',
          endDate: '2026-08-20',
          days: 20,
        },
        factor: 0.5,
        focalDate: '2026-08-10',
        firstEligibleDate: '2026-08-01',
        today: '2026-08-20',
      }),
    ).toEqual({ startDate: '2026-08-05', endDate: '2026-08-14', days: 10 });
    expect(
      zoomSelectedRange({
        selection: {
          startDate: '2026-08-10',
          endDate: '2026-08-10',
          days: 1,
        },
        factor: 0.5,
        focalDate: '2026-08-10',
        firstEligibleDate: '2026-08-01',
        today: '2026-08-20',
      }),
    ).toEqual({ startDate: '2026-08-10', endDate: '2026-08-10', days: 1 });
  });

  it('requests handle haptics only when the snapped selected day changes', () => {
    expect(shouldEmitRangeHandleHaptic(undefined, '2026-08-03')).toBe(true);
    expect(shouldEmitRangeHandleHaptic('2026-08-03', '2026-08-03')).toBe(false);
    expect(shouldEmitRangeHandleHaptic('2026-08-03', '2026-08-04')).toBe(true);
  });
});
