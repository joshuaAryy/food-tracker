import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import type { SetupPreviewResult } from '@food-tracker/shared';

export default function GoalPlanScreen() {
  const router = useRouter();
  const [preview, setPreview] = useState<SetupPreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [profile, goals, weightLogs] = await Promise.all([
        api.profile.get(),
        api.goals.get(),
        api.weightLogs.list(),
      ]);
      const currentWeightLb = weightLogs[0]?.weightLb ?? null;
      setPreview(
        await api.setup.preview({
          currentWeightLb,
          profile: {
            name: profile.name,
            birthDate: profile.birthDate,
            sex: profile.sex,
            heightInches: profile.heightInches,
            timezone: profile.timezone,
            startingWeightLb: profile.startingWeightLb,
            activityLevel: profile.activityLevel,
            trainingStyle: profile.trainingStyle,
          },
          goals: {
            goalType: goals.goalType,
            goalPace: goals.goalPace,
            targetRateLbPerWeek: goals.targetRateLbPerWeek,
            targetWeightLb: goals.targetWeightLb,
          },
          preferences: { mode: 'simple', waterTrackingEnabled: false },
        }),
      );
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  if (loading)
    return (
      <AppScreen>
        <AppText variant="heading">Loading your plan…</AppText>
      </AppScreen>
    );
  if (error !== null || preview === null)
    return (
      <AppScreen>
        <ErrorState
          title="Couldn’t load your plan"
          message={error ?? 'Plan unavailable'}
          onRetry={() => void load()}
        />
      </AppScreen>
    );
  const rate = preview.calculatedTargets.targetRateLbPerWeek;
  return (
    <AppScreen contentClassName="gap-5">
      <ScreenHeader
        title="Goal plan"
        action={
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={() => router.back()}
          >
            <AppText variant="label">Back</AppText>
          </Pressable>
        }
      />
      <View className="gap-2 rounded-3xl bg-primary-soft p-5">
        <AppText variant="caption" muted>
          Recommended starting plan
        </AppText>
        <AppText variant="number">
          {preview.calculatedTargets.targetCalories.toLocaleString()} kcal
        </AppText>
        <AppText muted>
          {preview.calculatedTargets.targetProteinGrams.toFixed(1)} g protein
          daily
        </AppText>
        <AppText variant="caption" muted>
          {rate === null
            ? 'Automatic rate planning is unavailable for this age/model; your goal and targets remain available.'
            : `Selected rate: ${rate} lb/week · Estimated completion: ${preview.calculatedTargets.estimatedGoalDate ?? 'not available'}`}
        </AppText>
      </View>
      <AppText muted>
        These are recommendations, not promises. Update your current weight and
        profile as your plan changes.
      </AppText>
    </AppScreen>
  );
}
