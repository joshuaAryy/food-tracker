import type { UserGoal, UserProfile } from '@prisma/client';
import { goalsSchema, profileSchema } from '@food-tracker/shared';
import { serializeGoals, serializeProfile } from './serializers.js';

export function isCompleteProfile(
  profile: UserProfile | null,
): profile is UserProfile {
  return (
    profile !== null &&
    profile.name !== null &&
    profile.name.trim() !== '' &&
    profile.age !== null &&
    profile.birthDate !== null &&
    profile.sex !== null &&
    profile.sex.trim() !== '' &&
    profile.heightInches !== null &&
    profile.startingWeightLb !== null &&
    profile.activityLevel !== null &&
    profile.trainingStyle !== null &&
    profileSchema.safeParse(serializeProfile(profile)).success
  );
}

export function isCompleteGoals(goals: UserGoal | null): goals is UserGoal {
  return (
    goals !== null &&
    ((goals.goalType === 'maintain' && goals.goalPace === null) ||
      (goals.goalType !== 'maintain' && goals.goalPace !== null)) &&
    goals.targetWeightLb !== null &&
    goals.targetCalories !== null &&
    goals.targetProteinGrams !== null &&
    goalsSchema.safeParse(serializeGoals(goals)).success
  );
}
