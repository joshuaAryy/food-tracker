jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        apiUrl: 'https://food-tracker.test/api/v1',
        appEnvironment: 'development',
      },
    },
  },
}));

import { draftsForTargets, type TargetRow } from '../nutrition-targets';

describe('nutrition target draft synchronization', () => {
  it('reflects the effective value after Use recommended', () => {
    const targets: TargetRow[] = [
      {
        nutrientKey: 'calories',
        unit: 'kcal',
        direction: 'target',
        effectiveValue: 2760,
        recommendedValue: 2760,
        effectiveSource: 'personalized',
        isCustom: false,
      },
    ];

    expect(draftsForTargets(targets)).toEqual({ calories: '2760' });
  });

  it('uses an empty draft for an unavailable effective target', () => {
    const targets: TargetRow[] = [
      {
        nutrientKey: 'vitaminD',
        unit: 'mcg',
        direction: 'minimum',
        effectiveValue: null,
        recommendedValue: null,
        effectiveSource: 'missing',
        isCustom: false,
      },
    ];

    expect(draftsForTargets(targets)).toEqual({ vitaminD: '' });
  });
});
