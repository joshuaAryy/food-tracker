import { describe, expect, it } from 'vitest';
import { macroSegments } from './macro-geometry';

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
});
