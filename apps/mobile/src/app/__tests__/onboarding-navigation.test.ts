import { describe, expect, it } from 'vitest';
import {
  nextOnboardingStepIndex,
  previousOnboardingStepIndex,
} from '../../lib/onboarding-navigation';

const steps = [
  { key: 'goalType' },
  { key: 'targetWeight' },
  { key: 'progressInfo' },
  { key: 'goalPace' },
  { key: 'activity' },
] as const;

describe('onboarding step navigation', () => {
  it('skips Goal Pace for maintain goals', () => {
    expect(nextOnboardingStepIndex(steps, 2, 'maintain')).toBe(4);
  });

  it.each(['lose', 'gain'] as const)(
    'keeps Goal Pace for %s goals',
    (goalType) => {
      expect(nextOnboardingStepIndex(steps, 2, goalType)).toBe(3);
    },
  );

  it('also skips Goal Pace when going back through a maintain flow', () => {
    expect(previousOnboardingStepIndex(steps, 4, 'maintain')).toBe(2);
  });
});
