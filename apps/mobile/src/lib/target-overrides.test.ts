import { describe, expect, it } from 'vitest';
import { targetOverrideFieldsForProfileEdit } from './target-overrides';

describe('profile target override intent', () => {
  it.each([
    [false, false, []],
    [true, false, ['calories']],
    [false, true, ['protein']],
    [true, true, ['calories', 'protein']],
  ])(
    'selects only fields changed by the user',
    (caloriesChanged, proteinChanged, expected) => {
      expect(
        targetOverrideFieldsForProfileEdit({ caloriesChanged, proteinChanged }),
      ).toEqual(expected);
    },
  );
});
