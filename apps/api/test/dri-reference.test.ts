import { describe, expect, it } from 'vitest';
import {
  DRI_TARGET_COMPATIBILITY,
  isDriProviderCompatible,
  resolveDriReferenceTarget,
} from '../src/modules/nutritionTargets/dri-reference.js';
import {
  mapCiqualNutrient,
  mapProviderNutrient,
} from '../src/modules/foodItems/providers/nutrient-mapping.js';

describe('DRI target compatibility', () => {
  it('rejects unit-only semantic matches', () => {
    expect(DRI_TARGET_COMPATIBILITY.vitaminA.status).toBe('unavailable');
    expect(DRI_TARGET_COMPATIBILITY.folate.status).toBe('unavailable');
    expect(DRI_TARGET_COMPATIBILITY.niacin.status).toBe('unavailable');
    expect(DRI_TARGET_COMPATIBILITY.vitaminD.providers).toEqual(
      expect.arrayContaining([
        'cnf',
        'ciqual',
        'cofid',
        'usda_fdc',
        'open_food_facts',
      ]),
    );
    expect(isDriProviderCompatible('vitaminD', 'usda_fdc')).toBe(true);
    expect(isDriProviderCompatible('vitaminD', 'cnf')).toBe(true);
    expect(isDriProviderCompatible('vitaminA', 'usda_fdc')).toBe(false);
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
    expect(resolveDriReferenceTarget('calcium', 13, 'female')).toMatchObject({
      value: 1300,
      source: 'reference',
    });
    expect(resolveDriReferenceTarget('calcium', 0, 'female')).toBeNull();
    expect(resolveDriReferenceTarget('calcium', 51, 'female')).toMatchObject({
      value: 1200,
      source: 'reference',
    });
    expect(resolveDriReferenceTarget('vitaminD', 71, 'female')).toMatchObject({
      value: 20,
    });
  });

  it('documents provider mappings that preserve the approved DRI quantities', () => {
    expect(mapProviderNutrient('Vitamin D', 2, 'mcg')).toMatchObject({
      key: 'vitaminD',
      unit: 'mcg',
    });
    expect(mapProviderNutrient('Calcium', 100, 'mg')).toMatchObject({
      key: 'calcium',
      unit: 'mg',
    });
    expect(mapProviderNutrient('Potassium', 200, 'mg')).toMatchObject({
      key: 'potassium',
      unit: 'mg',
    });
    expect(
      mapProviderNutrient('Vitamin D (International Units)', 400, 'IU'),
    ).toBeNull();
    expect(mapCiqualNutrient('Vitamine D (µg 100 g)', 2, 'µg')).toMatchObject({
      key: 'vitaminD',
      unit: 'mcg',
    });
  });
});
