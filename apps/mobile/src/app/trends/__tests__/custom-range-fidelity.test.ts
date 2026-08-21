import { describe, expect, it } from 'vitest';
import {
  fullHistoryRailViewport,
  panSelectedRange,
  railInteractionForPosition,
  zoomSelectedRange,
} from '../../../lib/analytics/custom-range';

describe('Custom Range fidelity interactions', () => {
  it('moves the complete selected rail range and keeps the inclusive span', () => {
    expect(
      panSelectedRange({
        selection: {
          startDate: '2026-07-01',
          endDate: '2026-07-30',
          days: 30,
        },
        deltaDays: 7,
        firstEligibleDate: '2026-06-01',
        today: '2026-08-01',
      }),
    ).toEqual({ startDate: '2026-07-03', endDate: '2026-08-01', days: 30 });
  });

  it('zooms a one-day selection without expanding it or crossing today', () => {
    expect(
      zoomSelectedRange({
        selection: {
          startDate: '2026-08-01',
          endDate: '2026-08-01',
          days: 1,
        },
        factor: 0.5,
        focalDate: '2026-08-01',
        firstEligibleDate: '2026-07-01',
        today: '2026-08-01',
      }),
    ).toEqual({ startDate: '2026-08-01', endDate: '2026-08-01', days: 1 });
  });

  it('uses the complete eligible history as the rail viewport and prioritizes endpoint hit areas', () => {
    const viewport = fullHistoryRailViewport({
      firstEligibleDate: '2026-06-01',
      today: '2026-08-01',
    });
    const selection = {
      startDate: '2026-07-25',
      endDate: '2026-08-01',
      days: 8,
    };

    expect(viewport).toEqual({
      startDate: '2026-06-01',
      endDate: '2026-08-01',
    });
    expect(
      railInteractionForPosition({
        position: 0.89,
        selection,
        viewport,
        handleHitSlop: 0.04,
      }),
    ).toEqual({ kind: 'handle', handle: 'start' });
    expect(
      railInteractionForPosition({
        position: 0.95,
        selection,
        viewport,
        handleHitSlop: 0.04,
      }),
    ).toEqual({ kind: 'range' });
  });
});
