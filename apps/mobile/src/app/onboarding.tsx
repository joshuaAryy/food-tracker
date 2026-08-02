import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
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
import { AppInput } from '@/components/app-input';
import { AppLogo } from '@/components/app-logo';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { OnboardingChoiceDeck } from '@/components/onboarding-choice-deck';
import {
  OnboardingDateWheel,
  type DateWheelValue,
} from '@/components/onboarding-date-wheel';
import {
  OnboardingHeightWheel,
  type HeightUnit,
} from '@/components/onboarding-height-wheel';
import { OnboardingPanel } from '@/components/onboarding-panel';
import { OnboardingPlanPreview } from '@/components/onboarding-plan-preview';
import { OnboardingQuestion } from '@/components/onboarding-question';
import { OnboardingScale } from '@/components/onboarding-scale';
import { OnboardingShell } from '@/components/onboarding-shell';
import { OnboardingStepTransition } from '@/components/onboarding-step-transition';
import { OnboardingSummaryGroup } from '@/components/onboarding-summary-group';
import { OnboardingSupport } from '@/components/onboarding-support';
import {
  OnboardingPlanExplainer,
  OnboardingWeightForecast,
} from '@/components/onboarding-visual-modules';
import { OnboardingWeightWheel } from '@/components/onboarding-weight-wheel';
import { SummaryRow } from '@/components/summary-row';
import { api, errorMessage } from '@/lib/api-client';
import { trackingModeLabel } from '@/lib/reporting-ui';
import { useAppStore } from '@/store/app-store';
import { useAuthRuntime } from '@/components/auth/auth-bootstrap';
import { reportDiagnostic } from '@/lib/safe-diagnostics';

type StepKey =
  | 'mode'
  | 'name'
  | 'birthday'
  | 'sex'
  | 'height'
  | 'currentWeight'
  | 'goalType'
  | 'targetWeight'
  | 'progressInfo'
  | 'goalPace'
  | 'activity'
  | 'training'
  | 'timezone'
  | 'planInfo'
  | 'review';

interface OnboardingForm {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  heightInches: string;
  sex: 'male' | 'female';
  startingWeightLb: string;
  targetWeightLb: string;
  timezone: string;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  goalPace: GoalPace | 'none';
  trainingStyle: TrainingStyle;
  mode: TrackingMode;
}

interface StepDefinition {
  key: StepKey;
  progressLabel: string;
}

const steps: readonly StepDefinition[] = [
  { key: 'mode', progressLabel: 'Tracking style' },
  { key: 'name', progressLabel: 'Setup · Profile' },
  { key: 'birthday', progressLabel: 'Birthday' },
  { key: 'sex', progressLabel: 'Profile details' },
  { key: 'height', progressLabel: 'Height' },
  { key: 'currentWeight', progressLabel: 'Current weight' },
  { key: 'goalType', progressLabel: 'Setup · Goal' },
  { key: 'targetWeight', progressLabel: 'Target weight' },
  { key: 'progressInfo', progressLabel: 'Progress direction' },
  { key: 'goalPace', progressLabel: 'Goal pace' },
  { key: 'activity', progressLabel: 'Setup · Activity' },
  { key: 'training', progressLabel: 'Training style' },
  { key: 'timezone', progressLabel: 'Daily timeline' },
  { key: 'planInfo', progressLabel: 'Starting plan' },
  { key: 'review', progressLabel: 'Setup · Review' },
] as const;

const firstStep: StepDefinition = {
  key: 'mode',
  progressLabel: 'Tracking style',
};

const activityDescriptions: Record<ActivityLevel, string> = {
  sedentary: 'Mostly sitting, little formal exercise',
  lightly_active: 'Daily movement or occasional training',
  moderately_active: 'Training or sport a few days each week',
  very_active: 'Hard training or an active physical job',
  athlete: 'High-volume sport or performance training',
};

const trainingDescriptions: Record<TrainingStyle, string> = {
  none: 'No structured training right now',
  cardio: 'Mostly endurance or conditioning',
  weight_training: 'Mostly lifting or strength work',
  mixed: 'A mix of strength and cardio',
  athlete: 'Sport-specific training',
};

const trackingDescriptions: Record<TrackingMode, string> = {
  simple: 'Calories, protein, and weight without extra daily friction.',
  complex: 'Macros and nutrients when you want a more detailed food log.',
};

const goalDescriptions: Record<GoalType, string> = {
  lose: 'A measured deficit toward a lower target weight.',
  maintain: 'Keep weight steady while building tracking consistency.',
  gain: 'A controlled surplus toward a higher target weight.',
};

const paceDescriptions: Record<GoalPace | 'none', string> = {
  slow: 'Gentler deficit',
  moderate: 'Balanced deficit',
  aggressive: 'Faster deficit',
  lean_bulk: 'Small surplus',
  moderate_bulk: 'Balanced surplus',
  aggressive_bulk: 'Faster surplus',
  none: 'Steady maintenance',
};

const goalPaceOptions: Record<GoalType, ReadonlyArray<GoalPace | 'none'>> = {
  lose: ['slow', 'moderate', 'aggressive'],
  maintain: ['none'],
  gain: ['lean_bulk', 'moderate_bulk', 'aggressive_bulk'],
};

const goalOptions = GOAL_TYPES.map((value) => ({
  value,
  label: label(value),
  description: goalDescriptions[value],
  meta: value === 'maintain' ? 'Steady' : 'Targeted',
}));

const trainingOptions = TRAINING_STYLES.map((value) => ({
  value,
  label: label(value),
  description: trainingDescriptions[value],
}));

const activityOptions = ACTIVITY_LEVELS.map((value) => ({
  value,
  label:
    value === 'sedentary'
      ? 'Low'
      : value === 'lightly_active'
        ? 'Light'
        : value === 'moderately_active'
          ? 'Moderate'
          : value === 'very_active'
            ? 'High'
            : 'Athlete',
  description: activityDescriptions[value],
}));

const timezone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto';
const defaultBirthDate: DateWheelValue = {
  month: 6,
  day: 15,
  year: 1994,
};

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

function heightFromValue(value: string): number | null {
  const heightInches = Number(value);

  if (!Number.isInteger(heightInches) || heightInches <= 0) {
    return null;
  }

  return heightInches;
}

function formatHeight(values: Partial<OnboardingForm>): string {
  const height = heightFromValue(values.heightInches ?? '');

  if (height === null) return '—';
  return `${Math.floor(height / 12)} ft ${height % 12} in · ${Math.round(
    height * 2.54,
  )} cm`;
}

function weightFromValue(value: string | undefined): number {
  const weight = Number(value);

  return Number.isFinite(weight) && weight > 0 ? weight : 180;
}

function heightWheelValue(value: string | undefined): number {
  const height = heightFromValue(value ?? '');

  return height ?? 68;
}

function weightDirectionLabel(values: Partial<OnboardingForm>): string {
  const current = weightFromValue(values.startingWeightLb);
  const target = weightFromValue(values.targetWeightLb);
  const delta = Math.round((target - current) * 10) / 10;

  if (delta === 0) return 'Hold steady while building tracking consistency.';

  return `${Math.abs(delta).toFixed(1)} lb ${
    delta > 0 ? 'up' : 'down'
  } from your starting point.`;
}

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function setupInput(values: OnboardingForm): SetupInput {
  const birthDate = birthDateFromParts(values);
  if (birthDate === null) {
    throw new Error('Enter a valid birthday using year, month, and day.');
  }

  const heightInches = heightFromValue(values.heightInches);
  if (heightInches === null) {
    throw new Error('Enter a valid height.');
  }

  return {
    profile: {
      name: values.name.trim(),
      birthDate,
      sex: values.sex,
      heightInches,
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

function ContinueButton({
  children,
  disabled = false,
  loading = false,
  onPress,
}: {
  children: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <AppButton
      className={`min-h-[62px] rounded-full ${
        disabled
          ? 'border-onboarding-surface-muted bg-onboarding-surface-muted'
          : 'border-onboarding-text bg-onboarding-text'
      }`}
      disabled={disabled}
      loading={loading}
      onPress={onPress}
    >
      {children}
    </AppButton>
  );
}

function SegmentedChoice<T extends string>({
  values,
  value,
  labels,
  onChange,
}: {
  values: readonly T[];
  value: T;
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row rounded-full bg-onboarding-surface p-1">
      {values.map((option) => {
        const selected = value === option;

        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`min-h-[56px] flex-1 items-center justify-center rounded-full px-3 ${
              selected ? 'bg-onboarding-text' : 'bg-transparent'
            }`}
            onPress={() => onChange(option)}
          >
            <AppText
              variant="label"
              className={selected ? 'text-white' : 'text-onboarding-text'}
            >
              {labels[option]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function TrackingModeChoice({
  value,
  onChange,
}: {
  value: TrackingMode;
  onChange: (value: TrackingMode) => void;
}) {
  return (
    <View className="gap-3">
      {TRACKING_MODES.map((option) => {
        const selected = option === value;
        const simple = option === 'simple';

        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`min-h-[108px] rounded-[34px] px-5 py-4 active:opacity-75 ${
              selected ? 'bg-onboarding-surface' : 'bg-transparent'
            }`}
            onPress={() => onChange(option)}
          >
            <View className="flex-row items-center gap-4">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-onboarding-surface">
                <AppLogo
                  size={simple ? 32 : 34}
                  mode={simple ? 'simple' : 'complex'}
                  tone="onboarding"
                />
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center justify-between gap-3">
                  <AppText variant="heading" className="text-onboarding-text">
                    {trackingModeLabel(simple ? 'simple' : 'complex')} tracking
                  </AppText>
                  <View
                    className={`rounded-full px-3 py-1 ${
                      selected
                        ? 'bg-onboarding-text'
                        : 'bg-onboarding-surface-muted'
                    }`}
                  >
                    <AppText
                      variant="caption"
                      className={
                        selected ? 'text-white' : 'text-onboarding-muted'
                      }
                    >
                      {simple ? 'Core' : 'Full'}
                    </AppText>
                  </View>
                </View>
                <AppText className="mt-2 text-onboarding-muted leading-5">
                  {trackingDescriptions[option]}
                </AppText>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { markSetupComplete } = useAuthRuntime();
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [stepIndex, setStepIndex] = useState(0);
  const [navigationDirection, setNavigationDirection] = useState<
    'forward' | 'back'
  >('forward');
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SetupPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('imperial');

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
      birthYear: String(defaultBirthDate.year),
      birthMonth: String(defaultBirthDate.month),
      birthDay: String(defaultBirthDate.day),
      sex: 'male',
      heightInches: '68',
      startingWeightLb: '180',
      targetWeightLb: '180',
      timezone,
      activityLevel: 'lightly_active',
      goalType: 'maintain',
      goalPace: 'none',
      trainingStyle: 'none',
      mode: 'simple',
    },
  });

  const values = useWatch({ control });
  const mode = useWatch({ control, name: 'mode' });
  const goalType = useWatch({ control, name: 'goalType' });
  const paceOptions = useMemo(() => goalPaceOptions[goalType], [goalType]);
  const currentStep = steps[stepIndex] ?? firstStep;
  const stepKey = currentStep.key;
  const birthdayValue = useMemo<DateWheelValue>(
    () => ({
      month: Number(values.birthMonth) || defaultBirthDate.month,
      day: Number(values.birthDay) || defaultBirthDate.day,
      year: Number(values.birthYear) || defaultBirthDate.year,
    }),
    [values.birthDay, values.birthMonth, values.birthYear],
  );
  const handleBirthdayChange = useCallback(
    (nextBirthday: DateWheelValue) => {
      setValue('birthMonth', String(nextBirthday.month), {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue('birthDay', String(nextBirthday.day), {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue('birthYear', String(nextBirthday.year), {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [setValue],
  );

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
    if (stepKey === 'review') {
      void refreshPreview();
    }
  }, [refreshPreview, stepKey]);

  const validateStep = async () => {
    if (stepKey === 'name') return trigger('name');
    if (stepKey === 'birthday') {
      if (birthDateFromParts(getValues()) !== null) {
        return true;
      }
      setError('Choose a valid birthday.');
      return false;
    }
    if (stepKey === 'height') return trigger('heightInches');
    if (stepKey === 'currentWeight') return trigger('startingWeightLb');
    if (stepKey === 'targetWeight') return trigger('targetWeightLb');
    if (stepKey === 'timezone') return trigger('timezone');
    return true;
  };

  const next = async () => {
    if (transitioning) return;
    setError(null);
    const valid = await validateStep();
    if (!valid) return;

    if (stepKey === 'goalType') {
      const nextGoalType = getValues('goalType');
      if (nextGoalType === 'maintain') {
        setValue('targetWeightLb', getValues('startingWeightLb'), {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }

    setNavigationDirection('forward');
    setStepIndex((current) => Math.min(steps.length - 1, current + 1));
  };

  const back = () => {
    if (transitioning) return;
    setError(null);
    setNavigationDirection('back');
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const save = handleSubmit(async (submittedValues) => {
    setError(null);
    reportDiagnostic('onboarding_completion_started');

    try {
      await api.setup.update(setupInput(submittedValues));
      reportDiagnostic('onboarding_completion_succeeded');
      markDataChanged();
      markSetupComplete();
      reportDiagnostic('setup_state_marked_complete');
      router.replace('/(tabs)/progress');
    } catch (saveError) {
      setError(errorMessage(saveError));
    }
  });

  const support =
    stepKey === 'mode' ? (
      <OnboardingSupport
        label="What this changes"
        value="Simple keeps logging light. Complex gives you more nutrition detail when you want it."
      />
    ) : stepKey === 'name' ? (
      <OnboardingSupport
        label="Used for"
        value="Your name keeps the app feeling personal."
      />
    ) : stepKey === 'birthday' ? (
      <OnboardingSupport
        label="Why we ask"
        value="Your age helps make your starting targets more useful."
      />
    ) : stepKey === 'sex' ? (
      <OnboardingSupport
        label="Why we ask"
        value="This helps personalize your first calorie target."
      />
    ) : stepKey === 'height' ? (
      <OnboardingSupport
        label="Units"
        value="Choose the unit that feels natural. You can change this later."
      />
    ) : stepKey === 'currentWeight' ? (
      <OnboardingSupport
        label="Starting point"
        value="This gives your plan a clear place to start."
      />
    ) : stepKey === 'targetWeight' ? (
      <OnboardingSupport
        label="Editable later"
        value="Use a practical target for now. You can change it from Profile after setup."
      />
    ) : stepKey === 'goalPace' ? (
      <OnboardingSupport
        label="You can change this"
        value="Choose a pace that feels realistic for your normal week."
      />
    ) : stepKey === 'activity' ? (
      <OnboardingSupport
        label="Best guess is enough"
        value="Pick the closest normal week. You can adjust this later."
      />
    ) : stepKey === 'timezone' ? (
      <OnboardingSupport
        label="Detected from device"
        value="This keeps daily history and progress aligned to your local day."
      />
    ) : undefined;

  const footer =
    stepKey === 'review' ? (
      <ContinueButton
        disabled={preview === null || previewLoading || transitioning}
        loading={isSubmitting}
        onPress={() => void save()}
      >
        Start tracking
      </ContinueButton>
    ) : (
      <ContinueButton disabled={transitioning} onPress={() => void next()}>
        {stepKey === 'mode'
          ? mode === 'simple'
            ? 'Start simple'
            : 'Start complex'
          : 'Continue'}
      </ContinueButton>
    );

  return (
    <OnboardingShell
      currentStep={stepIndex + 1}
      totalSteps={steps.length}
      progressLabel={currentStep.progressLabel}
      footer={footer}
      support={support}
      onBack={stepIndex === 0 ? undefined : back}
    >
      <OnboardingStepTransition
        stepKey={stepKey}
        direction={navigationDirection}
        onTransitioningChange={setTransitioning}
      >
        <View className="flex-1 gap-7 pb-4">
          {error === null ? null : (
            <ErrorState title="Onboarding needs attention" message={error} />
          )}

          {stepKey === 'mode' ? (
            <>
              <OnboardingQuestion
                title="How simple should tracking feel?"
                subtitle="Choose the level of detail you want in your daily food log."
              />
              <Controller
                control={control}
                name="mode"
                render={({ field }) => (
                  <TrackingModeChoice
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </>
          ) : null}

          {stepKey === 'name' ? (
            <>
              <OnboardingQuestion
                title="What should we call you?"
                subtitle="This keeps your progress and plan personal."
              />
              <OnboardingPanel>
                <Controller
                  control={control}
                  name="name"
                  rules={{ required: 'Enter your name.' }}
                  render={({ field }) => (
                    <AppInput
                      label="Name"
                      className="border-transparent bg-onboarding-surface-muted text-onboarding-text"
                      autoCapitalize="words"
                      value={field.value}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      error={errors.name?.message}
                    />
                  )}
                />
              </OnboardingPanel>
            </>
          ) : null}

          {stepKey === 'birthday' ? (
            <>
              <OnboardingQuestion
                title="When were you born?"
                subtitle="Your age helps estimate a useful starting target."
              />
              <OnboardingDateWheel
                value={birthdayValue}
                onChange={handleBirthdayChange}
              />
            </>
          ) : null}

          {stepKey === 'sex' ? (
            <>
              <OnboardingQuestion
                title="Which option should we use for your first targets?"
                subtitle="This helps personalize your calorie target."
              />
              <Controller
                control={control}
                name="sex"
                render={({ field }) => (
                  <SegmentedChoice
                    values={['male', 'female'] as const}
                    value={field.value}
                    labels={{ male: 'Male', female: 'Female' }}
                    onChange={field.onChange}
                  />
                )}
              />
            </>
          ) : null}

          {stepKey === 'height' ? (
            <>
              <OnboardingQuestion
                title="What is your height?"
                subtitle="Use the unit that feels natural."
              />
              <Controller
                control={control}
                name="heightInches"
                rules={{
                  required: 'Height is required.',
                  validate: (value) =>
                    heightFromValue(value) === null
                      ? 'Choose a valid height.'
                      : true,
                }}
                render={({ field }) => (
                  <OnboardingHeightWheel
                    heightInches={heightWheelValue(field.value)}
                    unit={heightUnit}
                    onUnitChange={setHeightUnit}
                    onHeightInchesChange={(nextHeight) =>
                      field.onChange(String(nextHeight))
                    }
                  />
                )}
              />
              {errors.heightInches?.message === undefined ? null : (
                <AppText variant="caption" className="text-error">
                  {errors.heightInches.message}
                </AppText>
              )}
            </>
          ) : null}

          {stepKey === 'currentWeight' ? (
            <>
              <OnboardingQuestion
                title="What is your current weight?"
                subtitle="This gives your plan a clear place to start."
              />
              <Controller
                control={control}
                name="startingWeightLb"
                rules={{
                  required: 'Current weight is required.',
                  validate: (value) =>
                    Number(value) > 0 ? true : 'Choose a weight above zero.',
                }}
                render={({ field }) => (
                  <OnboardingWeightWheel
                    label="Current weight"
                    valueLb={weightFromValue(field.value)}
                    onChange={(nextWeight) =>
                      field.onChange(nextWeight.toFixed(1))
                    }
                  />
                )}
              />
              {errors.startingWeightLb?.message === undefined ? null : (
                <AppText variant="caption" className="text-error">
                  {errors.startingWeightLb.message}
                </AppText>
              )}
            </>
          ) : null}

          {stepKey === 'goalType' ? (
            <>
              <OnboardingQuestion
                title="What are you aiming for?"
                subtitle="Choose the direction you want your starting plan to support."
              />
              <Controller
                control={control}
                name="goalType"
                render={({ field }) => (
                  <OnboardingChoiceDeck
                    options={goalOptions}
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
                )}
              />
            </>
          ) : null}

          {stepKey === 'targetWeight' ? (
            <>
              <OnboardingQuestion
                title="What weight are you working toward?"
                subtitle="Use the target that feels practical right now. You can edit it later."
              />
              <Controller
                control={control}
                name="targetWeightLb"
                rules={{
                  required: 'Target weight is required.',
                  validate: (value) =>
                    Number(value) > 0 ? true : 'Choose a weight above zero.',
                }}
                render={({ field }) => (
                  <OnboardingWeightWheel
                    label="Target weight"
                    referenceLb={weightFromValue(values.startingWeightLb)}
                    valueLb={weightFromValue(field.value)}
                    onChange={(nextWeight) =>
                      field.onChange(nextWeight.toFixed(1))
                    }
                  />
                )}
              />
              {errors.targetWeightLb?.message === undefined ? null : (
                <AppText variant="caption" className="text-error">
                  {errors.targetWeightLb.message}
                </AppText>
              )}
            </>
          ) : null}

          {stepKey === 'progressInfo' ? (
            <>
              <OnboardingQuestion
                title="Progress works best with direction."
                subtitle="Your starting weight and target show the direction you are working toward."
              />
              <OnboardingWeightForecast
                currentWeightLb={weightFromValue(values.startingWeightLb)}
                targetWeightLb={weightFromValue(values.targetWeightLb)}
                goalType={values.goalType ?? 'maintain'}
              />
            </>
          ) : null}

          {stepKey === 'goalPace' ? (
            <>
              <OnboardingQuestion
                title="What pace feels right?"
                subtitle="This sets the size of the calorie adjustment."
              />
              <Controller
                control={control}
                name="goalPace"
                render={({ field }) => (
                  <OnboardingScale
                    options={paceOptions.map((option) => ({
                      value: option,
                      label: label(option),
                      description: paceDescriptions[option],
                    }))}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </>
          ) : null}

          {stepKey === 'activity' ? (
            <>
              <OnboardingQuestion
                title="How active are most weeks?"
                subtitle="Pick the closest intensity. It helps estimate daily energy."
              />
              <Controller
                control={control}
                name="activityLevel"
                render={({ field }) => (
                  <OnboardingScale
                    options={activityOptions}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </>
          ) : null}

          {stepKey === 'training' ? (
            <>
              <OnboardingQuestion
                title="How do you usually train?"
                subtitle="Training style helps shape a useful protein target."
              />
              <Controller
                control={control}
                name="trainingStyle"
                render={({ field }) => (
                  <OnboardingChoiceDeck
                    options={trainingOptions}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </>
          ) : null}

          {stepKey === 'timezone' ? (
            <>
              <OnboardingQuestion
                title="What daily timeline should we use?"
                subtitle="This keeps history and progress aligned to your day."
              />
              <OnboardingPanel>
                <Controller
                  control={control}
                  name="timezone"
                  rules={{
                    required: 'Timezone is required.',
                    validate: (value) =>
                      isValidTimezone(value)
                        ? true
                        : 'Enter a valid IANA timezone.',
                  }}
                  render={({ field }) => (
                    <AppInput
                      label="Timezone"
                      className="border-transparent bg-onboarding-surface-muted text-onboarding-text"
                      hint="Detected from this device."
                      autoCapitalize="none"
                      value={field.value}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      error={errors.timezone?.message}
                    />
                  )}
                />
              </OnboardingPanel>
            </>
          ) : null}

          {stepKey === 'planInfo' ? (
            <>
              <OnboardingQuestion
                title="Your first plan starts simple."
                subtitle="Start by logging what you eat. We will keep your daily targets easy to see."
              />
              <OnboardingPlanExplainer mode={mode} />
            </>
          ) : null}

          {stepKey === 'review' ? (
            <>
              <OnboardingQuestion
                title="Here is your starting plan."
                subtitle="Your daily targets are ready. You can adjust them anytime."
              />
              {previewLoading ? (
                <LoadingState message="Calculating your starting targets…" />
              ) : (
                <View className="gap-4">
                  <OnboardingPlanPreview
                    mode={mode}
                    calories={
                      preview === null
                        ? '—'
                        : preview.calculatedTargets.targetCalories.toLocaleString()
                    }
                    protein={
                      preview === null
                        ? '—'
                        : preview.calculatedTargets.targetProteinGrams.toFixed(
                            0,
                          )
                    }
                  />
                  <View className="gap-4 rounded-[34px] bg-onboarding-surface-muted px-5 py-5">
                    <View className="flex-row items-center justify-between gap-4">
                      <View className="min-w-0 flex-1">
                        <AppText
                          variant="caption"
                          className="text-onboarding-muted uppercase tracking-[1.3px]"
                        >
                          Weight direction
                        </AppText>
                        <AppText
                          variant="heading"
                          className="mt-1 text-onboarding-text"
                        >
                          {label(values.goalType ?? 'maintain')}
                        </AppText>
                      </View>
                      <View className="h-12 w-12 items-center justify-center rounded-full bg-onboarding-surface">
                        <AppText
                          variant="heading"
                          className="text-onboarding-text"
                        >
                          {values.goalType === 'gain'
                            ? '+'
                            : values.goalType === 'lose'
                              ? '-'
                              : '='}
                        </AppText>
                      </View>
                    </View>
                    <View className="h-2 overflow-hidden rounded-full bg-onboarding-surface">
                      <View
                        className="h-full rounded-full bg-onboarding-text"
                        style={{
                          width: values.goalType === 'maintain' ? '50%' : '72%',
                        }}
                      />
                    </View>
                    <AppText className="text-onboarding-muted">
                      {weightDirectionLabel(values)}
                    </AppText>
                  </View>
                  <OnboardingSummaryGroup title="Plan inputs">
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
                    <SummaryRow label="Height" value={formatHeight(values)} />
                    <SummaryRow
                      label="Current"
                      value={
                        values.startingWeightLb === undefined ||
                        values.startingWeightLb === ''
                          ? '—'
                          : `${values.startingWeightLb} lb`
                      }
                    />
                    <SummaryRow
                      label="Target"
                      value={
                        values.targetWeightLb === undefined ||
                        values.targetWeightLb === ''
                          ? '—'
                          : `${values.targetWeightLb} lb`
                      }
                    />
                    <SummaryRow
                      label="Goal"
                      value={`${label(values.goalType ?? '—')} · ${label(
                        values.goalPace ?? 'none',
                      )}`}
                    />
                    <SummaryRow
                      label="Activity"
                      value={label(values.activityLevel ?? '—')}
                    />
                    <SummaryRow
                      label="Training"
                      value={label(values.trainingStyle ?? '—')}
                    />
                    <SummaryRow
                      label="Tracking"
                      value={trackingModeLabel(mode)}
                      divided={false}
                    />
                  </OnboardingSummaryGroup>
                </View>
              )}
            </>
          ) : null}
        </View>
      </OnboardingStepTransition>
    </OnboardingShell>
  );
}
