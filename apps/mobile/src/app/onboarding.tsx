import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useRouter } from 'expo-router';
import type {
  ActivityLevel,
  GoalPace,
  GoalType,
  SetupInput,
  SetupPreviewResult,
  TrainingStyle,
  TrackingMode,
} from '@food-tracker/shared';
import {
  ACTIVITY_LEVELS,
  GOAL_TYPES,
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
import { SelectableOption } from '@/components/selectable-option';
import { SummaryRow } from '@/components/summary-row';
import { api, errorMessage } from '@/lib/api-client';
import { useAppStore } from '@/store/app-store';

interface OnboardingForm {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  sex: 'male' | 'female';
  heightInches: string;
  startingWeightLb: string;
  targetWeightLb: string;
  timezone: string;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  goalPace: GoalPace | 'none';
  trainingStyle: TrainingStyle;
  mode: TrackingMode;
}

const stepCount = 8;

const activityDescriptions: Record<ActivityLevel, string> = {
  sedentary: 'Mostly sitting, little exercise',
  lightly_active: 'Walks / occasional exercise',
  moderately_active: 'Training 3–5x per week',
  very_active: 'Intense training / physical job',
  athlete: 'Athlete / very high activity',
};

const trainingDescriptions: Record<TrainingStyle, string> = {
  none: 'No structured training',
  cardio: 'Mostly cardio',
  weight_training: 'Mostly weight training',
  mixed: 'Cardio and weight training',
  athlete: 'Sport-focused training',
};

const trackingDescriptions: Record<TrackingMode, string> = {
  simple: 'Calories, protein, and weight',
  complex: 'Macros, fiber, sugar, sodium, and deeper insights',
};

const goalPaceOptions: Record<GoalType, ReadonlyArray<GoalPace | 'none'>> = {
  lose: ['slow', 'moderate', 'aggressive'],
  maintain: ['none'],
  gain: ['lean_bulk', 'moderate_bulk', 'aggressive_bulk'],
};

const timezone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto';

function padded(value: number): string {
  return String(value).padStart(2, '0');
}

function birthDateFromParts(values: {
  birthYear: string;
  birthMonth: string;
  birthDay: string;
}): string | null {
  const year = Number(values.birthYear);
  const month = Number(values.birthMonth);
  const day = Number(values.birthDay);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  if (date > todayUtc) {
    return null;
  }

  return `${year}-${padded(month)}-${padded(day)}`;
}

function label(value: string): string {
  if (value === 'none') return 'Maintenance';

  return value
    .split('_')
    .map((part) => part[0]?.toUpperCase().concat(part.slice(1)) ?? part)
    .join(' ');
}

function calculateAgeLabel(values: {
  birthYear?: string;
  birthMonth?: string;
  birthDay?: string;
}): string {
  const birthDate = birthDateFromParts({
    birthYear: values.birthYear ?? '',
    birthMonth: values.birthMonth ?? '',
    birthDay: values.birthDay ?? '',
  });
  if (birthDate === null) {
    return '—';
  }

  const [year = 0, month = 0, day = 0] = birthDate.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - Number(year);
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age -= 1;
  }

  return Number.isFinite(age) && age >= 0 ? String(age) : '—';
}

function ChoiceGrid<T extends string>({
  values,
  value,
  descriptions,
  onChange,
}: {
  values: readonly T[];
  value: T;
  descriptions?: Partial<Record<T, string>>;
  onChange: (value: T) => void;
}) {
  return (
    <View className="gap-2">
      {values.map((option) => (
        <SelectableOption
          key={option}
          value={option}
          selected={value === option}
          label={label(option)}
          description={descriptions?.[option]}
          onSelect={onChange}
        />
      ))}
    </View>
  );
}

function setupInput(values: OnboardingForm): SetupInput {
  const birthDate = birthDateFromParts(values);
  if (birthDate === null) {
    throw new Error('Enter a valid birthday using year, month, and day.');
  }

  return {
    profile: {
      name: values.name.trim(),
      birthDate,
      sex: values.sex,
      heightInches: Number(values.heightInches),
      timezone: values.timezone.trim(),
      startingWeightLb: Number(values.startingWeightLb),
      activityLevel: values.activityLevel,
      trainingStyle: values.trainingStyle,
    },
    goals: {
      goalType: values.goalType,
      goalPace: values.goalPace === 'none' ? null : values.goalPace,
      targetWeightLb: Number(values.targetWeightLb),
    },
    preferences: {
      mode: values.mode,
      waterTrackingEnabled: false,
    },
  };
}

export default function OnboardingScreen() {
  const router = useRouter();
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SetupPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const {
    control,
    getValues,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingForm>({
    defaultValues: {
      name: '',
      birthYear: '',
      birthMonth: '',
      birthDay: '',
      sex: 'male',
      heightInches: '',
      startingWeightLb: '',
      targetWeightLb: '',
      timezone,
      activityLevel: 'lightly_active',
      goalType: 'maintain',
      goalPace: 'none',
      trainingStyle: 'none',
      mode: 'simple',
    },
  });

  const values = useWatch({ control });
  const goalType = useWatch({ control, name: 'goalType' });
  const paceOptions = useMemo(() => goalPaceOptions[goalType], [goalType]);

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    setError(null);

    try {
      setPreview(await api.setup.preview(setupInput(getValues())));
    } catch (previewError) {
      setPreview(null);
      setError(errorMessage(previewError));
    } finally {
      setPreviewLoading(false);
    }
  }, [getValues]);

  useEffect(() => {
    if (step === 7) {
      void refreshPreview();
    }
  }, [refreshPreview, step]);

  const next = async () => {
    setError(null);

    const valid = await trigger(
      step === 1
        ? ['name', 'birthYear', 'birthMonth', 'birthDay', 'sex']
        : step === 2
          ? ['heightInches', 'startingWeightLb', 'targetWeightLb', 'timezone']
          : [],
    );

    if (!valid) return;

    setStep((current) => Math.min(stepCount - 1, current + 1));
  };

  const back = () => {
    setError(null);
    setStep((current) => Math.max(0, current - 1));
  };

  const save = handleSubmit(async (submittedValues) => {
    setError(null);

    try {
      await api.setup.update(setupInput(submittedValues));
      markDataChanged();
      router.replace('/(tabs)/progress');
    } catch (saveError) {
      setError(errorMessage(saveError));
    }
  });

  const progressLabel = `Step ${Math.min(step + 1, stepCount)} of ${stepCount}`;

  return (
    <AppScreen contentClassName="gap-4">
      <ScreenHeader
        eyebrow={step === 0 ? undefined : progressLabel}
        title={step === 0 ? 'Welcome to Food Tracker' : 'Set up your plan'}
        subtitle={
          step === 0
            ? 'We’ll personalize your nutrition targets and tracking.'
            : 'Answer each question to build your starting targets.'
        }
      />

      {error === null ? null : (
        <ErrorState title="Onboarding needs attention" message={error} />
      )}

      {step === 0 ? (
        <AppCard elevated className="gap-4">
          <AppText variant="display">
            Nutrition targets that start with you.
          </AppText>
          <AppText muted>
            Food Tracker will ask a few setup questions, calculate calorie and
            protein targets with deterministic formulas, then take you into your
            daily Progress screen.
          </AppText>
          <AppText variant="caption" muted>
            No AI is used for target calculation. You can edit your information
            later in Profile.
          </AppText>
        </AppCard>
      ) : null}

      {step === 1 ? (
        <FormSection title="Basic info">
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
            name="birthYear"
            rules={{
              required: 'Birth year is required.',
              validate: () =>
                birthDateFromParts(getValues()) === null
                  ? 'Enter a valid birthday.'
                  : true,
            }}
            render={({ field }) => (
              <AppInput
                label="Year"
                placeholder="1990"
                keyboardType="number-pad"
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={errors.birthYear?.message}
              />
            )}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Controller
                control={control}
                name="birthMonth"
                rules={{
                  required: 'Birth month is required.',
                  validate: () =>
                    birthDateFromParts(getValues()) === null
                      ? 'Enter a valid month.'
                      : true,
                }}
                render={({ field }) => (
                  <AppInput
                    label="Month"
                    placeholder="5"
                    keyboardType="number-pad"
                    value={field.value}
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                    error={errors.birthMonth?.message}
                  />
                )}
              />
            </View>
            <View className="flex-1">
              <Controller
                control={control}
                name="birthDay"
                rules={{
                  required: 'Birth day is required.',
                  validate: () =>
                    birthDateFromParts(getValues()) === null
                      ? 'Enter a valid day.'
                      : true,
                }}
                render={({ field }) => (
                  <AppInput
                    label="Day"
                    placeholder="10"
                    keyboardType="number-pad"
                    value={field.value}
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                    error={errors.birthDay?.message}
                  />
                )}
              />
            </View>
          </View>
          <Controller
            control={control}
            name="sex"
            render={({ field }) => (
              <View className="gap-2">
                <AppText variant="label">Sex</AppText>
                <ChoiceGrid
                  values={['male', 'female'] as const}
                  value={field.value}
                  onChange={field.onChange}
                />
              </View>
            )}
          />
        </FormSection>
      ) : null}

      {step === 2 ? (
        <FormSection title="Body">
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
            name="startingWeightLb"
            rules={{
              required: 'Current weight is required.',
              validate: (value) =>
                Number(value) > 0 ? true : 'Enter a weight above zero.',
            }}
            render={({ field }) => (
              <AppInput
                label="Current weight (lb)"
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
            name="targetWeightLb"
            rules={{
              required: 'Goal weight is required.',
              validate: (value) =>
                Number(value) > 0 ? true : 'Enter a weight above zero.',
            }}
            render={({ field }) => (
              <AppInput
                label="Goal body weight (lb)"
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
        </FormSection>
      ) : null}

      {step === 3 ? (
        <FormSection title="Activity" description="How active are you?">
          <Controller
            control={control}
            name="activityLevel"
            render={({ field }) => (
              <ChoiceGrid
                values={ACTIVITY_LEVELS}
                value={field.value}
                descriptions={activityDescriptions}
                onChange={field.onChange}
              />
            )}
          />
        </FormSection>
      ) : null}

      {step === 4 ? (
        <FormSection title="Goal">
          <Controller
            control={control}
            name="goalType"
            render={({ field }) => (
              <View className="gap-2">
                <AppText variant="label">Goal direction</AppText>
                <ChoiceGrid
                  values={GOAL_TYPES}
                  value={field.value}
                  onChange={(nextGoalType) => {
                    field.onChange(nextGoalType);
                    const nextPace = goalPaceOptions[nextGoalType][0];
                    if (nextPace !== undefined) {
                      setValue('goalPace', nextPace, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }}
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
                <ChoiceGrid
                  values={paceOptions}
                  value={field.value}
                  onChange={field.onChange}
                />
              </View>
            )}
          />
        </FormSection>
      ) : null}

      {step === 5 ? (
        <FormSection title="Training style">
          <Controller
            control={control}
            name="trainingStyle"
            render={({ field }) => (
              <ChoiceGrid
                values={TRAINING_STYLES}
                value={field.value}
                descriptions={trainingDescriptions}
                onChange={field.onChange}
              />
            )}
          />
        </FormSection>
      ) : null}

      {step === 6 ? (
        <FormSection
          title="Tracking style"
          description="You can change this later."
        >
          <Controller
            control={control}
            name="mode"
            render={({ field }) => (
              <ChoiceGrid
                values={TRACKING_MODES}
                value={field.value}
                descriptions={trackingDescriptions}
                onChange={field.onChange}
              />
            )}
          />
        </FormSection>
      ) : null}

      {step === 7 ? (
        <FormSection title="Review your starting plan">
          {previewLoading ? (
            <LoadingState message="Calculating targets…" />
          ) : (
            <View className="gap-2">
              <SummaryRow label="Name" value={values.name ?? '—'} />
              <SummaryRow
                label="Age"
                value={
                  preview?.age?.toString() ??
                  calculateAgeLabel({
                    birthYear: values.birthYear ?? '',
                    birthMonth: values.birthMonth ?? '',
                    birthDay: values.birthDay ?? '',
                  })
                }
              />
              <SummaryRow label="Sex" value={label(values.sex ?? '—')} />
              <SummaryRow
                label="Height"
                value={
                  values.heightInches === undefined ||
                  values.heightInches === ''
                    ? '—'
                    : `${values.heightInches} in`
                }
              />
              <SummaryRow
                label="Current weight"
                value={
                  values.startingWeightLb === undefined ||
                  values.startingWeightLb === ''
                    ? '—'
                    : `${values.startingWeightLb} lb`
                }
              />
              <SummaryRow
                label="Target weight"
                value={
                  values.targetWeightLb === undefined ||
                  values.targetWeightLb === ''
                    ? '—'
                    : `${values.targetWeightLb} lb`
                }
              />
              <SummaryRow
                label="Activity"
                value={label(values.activityLevel ?? '—')}
              />
              <SummaryRow
                label="Goal"
                value={`${label(values.goalType ?? '—')} / ${label(values.goalPace ?? 'none')}`}
              />
              <SummaryRow
                label="Training"
                value={label(values.trainingStyle ?? '—')}
              />
              <SummaryRow label="Tracking" value={label(values.mode ?? '—')} />
              <SummaryRow
                label="Calories"
                value={
                  preview === null
                    ? '—'
                    : `${preview.calculatedTargets.targetCalories.toLocaleString()} kcal/day`
                }
              />
              <SummaryRow
                label="Protein"
                value={
                  preview === null
                    ? '—'
                    : `${preview.calculatedTargets.targetProteinGrams.toFixed(1)} g/day`
                }
              />
            </View>
          )}
        </FormSection>
      ) : null}

      <View className="flex-row gap-3">
        {step === 0 ? null : (
          <AppButton variant="secondary" className="flex-1" onPress={back}>
            Back
          </AppButton>
        )}
        {step < stepCount - 1 ? (
          <AppButton className="flex-1" onPress={() => void next()}>
            {step === 0 ? 'Start setup' : 'Continue'}
          </AppButton>
        ) : (
          <AppButton
            className="flex-1"
            loading={isSubmitting}
            disabled={preview === null || previewLoading}
            onPress={() => void save()}
          >
            Complete setup
          </AppButton>
        )}
      </View>
    </AppScreen>
  );
}
