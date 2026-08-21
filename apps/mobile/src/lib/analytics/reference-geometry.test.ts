import { describe, expect, it } from 'vitest';
import { referenceBand } from './reference-geometry';

describe('reference geometry', () => {
  it('renders a band only when both authoritative range bounds exist', () => {
    expect(
      referenceBand({ lower: 40, upper: 60 }, { min: 0, max: 100 }, 100),
    ).toEqual({ y: 40, height: 20 });
    expect(referenceBand(null, { min: 0, max: 100 }, 100)).toBeNull();
  });
});
