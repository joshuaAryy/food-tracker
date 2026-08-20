import { describe, expect, it } from 'vitest';
import {
  macroColors,
  macroDonutGeometry,
  macroSegments,
  macroSeparatorLines,
  stackedMacroSegments,
} from './macro-geometry';

describe('macro chart geometry', () => {
  it('keeps missing macros out of composition rather than making them zero', () => {
    expect(macroSegments({ protein: 20, carbs: null, fat: 10 })).toEqual([
      { key: 'protein', value: 20, fraction: 2 / 3 },
      { key: 'fat', value: 10, fraction: 1 / 3 },
    ]);
  });

  it('retains explicit zero as a known zero segment', () => {
    expect(macroSegments({ protein: 0, carbs: 20, fat: 10 })[0]).toEqual({
      key: 'protein',
      value: 0,
      fraction: 0,
    });
  });

  it('stacks only known macro values while retaining a recorded zero', () => {
    expect(stackedMacroSegments({ protein: 20, carbs: null, fat: 0 })).toEqual([
      { key: 'protein', value: 20, start: 0, end: 20 },
      { key: 'fat', value: 0, start: 20, end: 20 },
    ]);
  });

  it('centers the donut label bounds within the stroke-aware center hole', () => {
    expect(macroDonutGeometry(124)).toMatchObject({
      radius: 44,
      strokeWidth: 20,
      centerDiameter: 68,
      centerLabelBounds: { x: 28, y: 28, width: 68, height: 68 },
    });
  });

  it('creates one bounded separator at every non-empty macro boundary', () => {
    const separators = macroSeparatorLines(
      macroSegments({ protein: 24, carbs: 49, fat: 27 }),
      124,
      44,
      20,
    );

    expect(separators).toHaveLength(3);
    expect(separators[0]).toMatchObject({ x1: 62, y1: 29, x2: 62, y2: 17 });
    for (const separator of separators) {
      expect(Math.hypot(separator.x1 - 62, separator.y1 - 62)).toBeCloseTo(33);
      expect(Math.hypot(separator.x2 - 62, separator.y2 - 62)).toBeCloseTo(45);
    }
  });

  it('keeps macro colors stable in the shared identity map', () => {
    expect(macroColors).toEqual({
      protein: '#C9242D',
      carbs: '#33B866',
      fat: '#FFAD8F',
    });
  });
});
