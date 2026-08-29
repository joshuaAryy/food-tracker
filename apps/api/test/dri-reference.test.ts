import { describe, expect, it } from 'vitest';
import {
  DRI_TARGET_COMPATIBILITY,
  resolveDriReferenceTarget,
} from '../src/modules/nutritionTargets/dri-reference.js';

describe('DRI target compatibility', () => {
  it('rejects unit-only semantic matches', () => {
    expect(DRI_TARGET_COMPATIBILITY.vitaminA.status).toBe('unavailable');
    expect(DRI_TARGET_COMPATIBILITY.folate.status).toBe('unavailable');
    expect(DRI_TARGET_COMPATIBILITY.niacin.status).toBe('unavailable');
  });

  it('resolves age and sex references for the approved micronutrient pool', () => {
    expect(resolveDriReferenceTarget('vitaminD', 18, 'male')).toMatchObject({
      value: 15,
      unit: 'mcg',
      direction: 'minimum',
      source: 'reference',
    });
    expect(resolveDriReferenceTarget('calcium', 19, 'female')).toMatchObject({
      value: 1000,
      unit: 'mg',
      direction: 'minimum',
    });
    expect(resolveDriReferenceTarget('potassium', 19, 'male')).toMatchObject({
      value: 3400,
      unit: 'mg',
      direction: 'minimum',
    });
  });
});
