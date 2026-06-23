import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { useFocusEffect } from 'expo-router';
import type {
  ActivityLevel,
  GoalPace,
  GoalType,
  Goals,
  Profile,
  Sex,
  TrainingStyle,
  TrackingMode,
  TrackingPreferences,
} from '@food-tracker/shared';
import {
  ACTIVITY_LEVELS,
  GOAL_TYPES,
  GOAL_PACES,
  TRACKING_MODES,
  TRAINING_STYLES,
} from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { FormSection } from '@/components/form-section';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, ApiClientError, errorMessage } from '@/lib/api-client';
import { useAppStore } from '@/store/app-store';

interface ProfileForm {
  name: string;
  age: string;
  birthDate: string;
  sex: Sex;
  heightInches: string;
  timezone: string;
  startingWeightLb: string;
  activityLevel: ActivityLevel;
  trainingStyle: TrainingStyle;
  goalType: GoalType;
  goalPace: GoalPace | 'none';
  targetWeightLb: string;
  targetCalories: string;
  targetProteinGrams: string;
  mode: TrackingMode;
}

const defaultProfile: Profile = {
  name: 'New user',
  age: 30,
  birthDate: '1996-01-01',
  sex: 'male',
  heightInches: 68,
  timezone: 'America/Toronto',
  startingWeightLb: 170,
  activityLevel: 'lightly_active',
  trainingStyle: 'none',
};

const defaultGoals: Goals = {
  goalType: 'maintain',
  goalPace: null,
  targetWeightLb: 170,
  targetCalories: 2000,
  targetProteinGrams: 120,
};

const defaultPreferences: TrackingPreferences = {
  mode: 'simple',
  waterTrackingEnabled: false,
};

function formValues(
  profile: Profile,
  goals: Goals,
  preferences: TrackingPreferences,
): ProfileForm {
  return {
    name: profile.name,
    age: String(profile.age),
    birthDate: profile.birthDate,
    sex: profile.sex,
    heightInches: String(profile.heightInches),
    timezone: profile.timezone,
    startingWeightLb: String(profile.startingWeightLb),
    activityLevel: profile.activityLevel,
    trainingStyle: profile.trainingStyle,
    goalType: goals.goalType,
    goalPace: goals.goalPace ?? 'none',
    targetWeightLb: String(goals.targetWeightLb),
    targetCalories: String(goals.targetCalories),
    targetProteinGrams: String(goals.targetProteinGrams),
    mode: preferences.mode,
  };
}

async function optionalResource<T>(
  loader: () => Promise<T>,
  fallback: T,
): Promise<{ data: T; missing: boolean }> {
  try {
    return { data: await loader(), missing: false };
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'NOT_FOUND') {
      return { data: fallback, missing: true };
    }
    throw error;
  }
}

function label(value: string): string {
  return value
    .split('_')
    .map((part) => part[0]?.toUpperCase().concat(part.slice(1)) ?? part)
    .join(' ');
}

function ChoiceRow<T extends string>({
  values,
  value,
  onChange,
}: {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {values.map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            className={`min-h-10 items-center justify-center rounded-full border px-3.5 py-2 ${
              selected
                ? 'border-sage bg-sage-soft'
                : 'border-border bg-surface-raised'
            }`}
            onPress={() => onChange(option)}
          >
            <AppText
              variant="label"
              className={selected ? 'text-sage-dark' : 'text-muted'}
            >
              {label(option)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ProfileScreen() {
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasMissingData, setHasMissingData] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [savedPreferences, setSavedPreferences] =
    useState<TrackingPreferences>(defaultPreferences);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    defaultValues: formValues(defaultProfile, defaultGoals, defaultPreferences),
  });

  const loadProfile = useCallback(
    async (asRefresh = false) => {
      if (asRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      setNotice(null);

      try {
        const [profile, goals, preferences] = await Promise.all([
          optionalResource(api.profile.get, defaultProfile),
          optionalResource(api.goals.get, defaultGoals),
          optionalResource(api.trackingPreferences.get, defaultPreferences),
        ]);
        reset(formValues(profile.data, goals.data, preferences.data));
        setSavedPreferences(preferences.data);
        setHasMissingData(
          profile.missing || goals.missing || preferences.missing,
        );
        setHasLoaded(true);
      } catch (loadError) {
        setError(errorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [reset],
  );

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const save = handleSubmit(async (values) => {
    setError(null);
    setNotice(null);

    try {
      const goalPace = values.goalPace === 'none' ? null : values.goalPace;
      const [profile, goals, preferences] = await Promise.all([
        api.profile.update({
          name: values.name.trim(),
          age: Number(values.age),
          birthDate: values.birthDate.trim(),
          sex: values.sex,
          heightInches: Number(values.heightInches),
          timezone: values.timezone.trim(),
          startingWeightLb: Number(values.startingWeightLb),
          activityLevel: values.activityLevel,
          trainingStyle: values.trainingStyle,
        }),
        api.goals.update({
          goalType: values.goalType,
          goalPace,
          targetWeightLb: Number(values.targetWeightLb),
          targetCalories: Number(values.targetCalories),
          targetProteinGrams: Number(values.targetProteinGrams),
        }),
        api.trackingPreferences.update({
          mode: values.mode,
          waterTrackingEnabled: savedPreferences.waterTrackingEnabled,
        }),
      ]);
      reset(formValues(profile, goals, preferences));
      setSavedPreferences(preferences);
      setHasMissingData(false);
      setNotice('Profile, goals, and tracking mode saved.');
      markDataChanged();
    } catch (saveError) {
      setError(errorMessage(saveError));
    }
  });

  if (loading) {
    return (
      <AppScreen>
        <LoadingState message="Loading your profile…" />
      </AppScreen>
    );
  }

  if (error !== null && !hasLoaded) {
    return (
      <AppScreen>
        <ScreenHeader
          title="Profile"
          subtitle="Personal details, goals, and tracking mode."
        />
        <ErrorState
          title="Profile is unavailable"
          message={error}
          onRetry={() => void loadProfile()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      refreshing={refreshing}
      onRefresh={() => void loadProfile(true)}
      contentClassName="gap-4"
    >
      <ScreenHeader
        title="Profile"
        subtitle="Personal details, goals, and tracking mode."
      />

      {error === null ? null : (
        <ErrorState title="Couldn’t save profile" message={error} />
      )}
      {hasMissingData ? (
        <AppCard compact className="border-gold bg-surface">
          <AppText variant="label">Finish your setup</AppText>
          <AppText muted className="mt-1">
            The values below are suggestions only. Review every section before
            saving so your dashboard and recommendations use your information.
          </AppText>
        </AppCard>
      ) : null}
      {notice === null ? null : (
        <AppCard compact className="border-sage bg-sage-soft">
          <AppText variant="label" className="text-sage-dark">
            {notice}
          </AppText>
        </AppCard>
      )}

      <FormSection
        title="Profile basics"
        description="Used for deterministic target calculations and dashboard context."
      >
        <Controller
          control={control}
          name="name"
          rules={{ required: 'Name is required.' }}
          render={({ field }) => (
            <AppInput
              label="Name"
              autoCapitalize="words"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.name?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="age"
          rules={{
            required: 'Age is required.',
            validate: (value) =>
              Number.isInteger(Number(value)) && Number(value) >= 0
                ? true
                : 'Enter a whole number.',
          }}
          render={({ field }) => (
            <AppInput
              label="Age"
              keyboardType="number-pad"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.age?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="birthDate"
          rules={{
            required: 'Birthday is required.',
            pattern: {
              value: /^\d{4}-\d{2}-\d{2}$/,
              message: 'Use YYYY-MM-DD.',
            },
          }}
          render={({ field }) => (
            <AppInput
              label="Birthday"
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.birthDate?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="sex"
          render={({ field }) => (
            <View className="gap-2">
              <AppText variant="label">Sex</AppText>
              <ChoiceRow
                values={['male', 'female'] as const}
                value={field.value}
                onChange={field.onChange}
              />
            </View>
          )}
        />
        <Controller
          control={control}
          name="heightInches"
          rules={{
            required: 'Height is required.',
            validate: (value) =>
              Number.isInteger(Number(value)) && Number(value) > 0
                ? true
                : 'Enter total height in whole inches.',
          }}
          render={({ field }) => (
            <AppInput
              label="Height (total inches)"
              keyboardType="number-pad"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.heightInches?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="timezone"
          rules={{ required: 'Timezone is required.' }}
          render={({ field }) => (
            <AppInput
              label="Timezone"
              autoCapitalize="none"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.timezone?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="startingWeightLb"
          rules={{
            required: 'Starting weight is required.',
            validate: (value) =>
              Number(value) > 0 ? true : 'Enter a weight above zero.',
          }}
          render={({ field }) => (
            <AppInput
              label="Starting weight (lb)"
              keyboardType="decimal-pad"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.startingWeightLb?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="activityLevel"
          render={({ field }) => (
            <View className="gap-2">
              <AppText variant="label">Activity level</AppText>
              <ChoiceRow
                values={ACTIVITY_LEVELS}
                value={field.value}
                onChange={field.onChange}
              />
            </View>
          )}
        />
        <Controller
          control={control}
          name="trainingStyle"
          render={({ field }) => (
            <View className="gap-2">
              <AppText variant="label">Training style</AppText>
              <ChoiceRow
                values={TRAINING_STYLES}
                value={field.value}
                onChange={field.onChange}
              />
            </View>
          )}
        />
      </FormSection>

      <FormSection title="Goals">
        <Controller
          control={control}
          name="goalType"
          render={({ field }) => (
            <View className="gap-2">
              <AppText variant="label">Goal direction</AppText>
              <ChoiceRow
                values={GOAL_TYPES}
                value={field.value}
                onChange={field.onChange}
              />
            </View>
          )}
        />
        <Controller
          control={control}
          name="goalPace"
          render={({ field }) => (
            <View className="gap-2">
              <AppText variant="label">Goal pace</AppText>
              <ChoiceRow
                values={['none', ...GOAL_PACES] as const}
                value={field.value}
                onChange={field.onChange}
              />
            </View>
          )}
        />
        <Controller
          control={control}
          name="targetWeightLb"
          rules={{
            required: 'Target weight is required.',
            validate: (value) =>
              Number(value) > 0 ? true : 'Enter a weight above zero.',
          }}
          render={({ field }) => (
            <AppInput
              label="Target weight (lb)"
              keyboardType="decimal-pad"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.targetWeightLb?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="targetCalories"
          rules={{
            required: 'Calorie target is required.',
            validate: (value) =>
              Number.isInteger(Number(value)) && Number(value) >= 0
                ? true
                : 'Enter whole kilocalories.',
          }}
          render={({ field }) => (
            <AppInput
              label="Daily calorie target"
              keyboardType="number-pad"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.targetCalories?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="targetProteinGrams"
          rules={{
            required: 'Protein target is required.',
            validate: (value) =>
              Number(value) >= 0 ? true : 'Enter zero or more grams.',
          }}
          render={({ field }) => (
            <AppInput
              label="Daily protein target (g)"
              keyboardType="decimal-pad"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.targetProteinGrams?.message}
            />
          )}
        />
      </FormSection>

      <FormSection
        title="Tracking mode"
        description="Simple mode keeps the daily UI focused on calories, protein, and weight."
      >
        <Controller
          control={control}
          name="mode"
          render={({ field }) => (
            <ChoiceRow
              values={TRACKING_MODES}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>

      <AppButton loading={isSubmitting} onPress={() => void save()}>
        Save profile
      </AppButton>
    </AppScreen>
  );
}
