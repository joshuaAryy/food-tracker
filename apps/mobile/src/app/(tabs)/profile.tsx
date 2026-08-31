import type { ComponentType, ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Activity,
  Beef,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Dumbbell,
  Flame,
  Goal,
  MapPin,
  Ruler,
  Scale,
  SlidersHorizontal,
  Target,
  UserRound,
} from 'lucide-react-native';
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
import { AppInput } from '@/components/app-input';
import { AccountSignOutButton } from '@/components/auth/account-sign-out-button';
import {
  DeleteAccountPanel,
  type AccountDeletionActions,
} from '@/components/auth/account-deletion';
import { AppLogo } from '@/components/app-logo';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import {
  SkeletonLine,
  SkeletonPill,
  SkeletonRail,
} from '@/components/skeleton';
import { syncLauncherIconToMode } from '@/lib/app-icon';
import { useAuthRuntime } from '@/components/auth/auth-bootstrap';
import { api, ApiClientError, errorMessage } from '@/lib/api-client';
import { trackingModeLabel } from '@/lib/reporting-ui';
import { reportDiagnostic } from '@/lib/safe-diagnostics';
import { useAppStore } from '@/store/app-store';
import { colors } from '@/theme/tokens';
import { registerPushInstallation } from '@/services/notifications';

type SettingsIcon = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

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
  targetRateLbPerWeek: string;
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
  targetCarbsGrams: null,
  targetFatGrams: null,
  targetFiberGrams: null,
  limitSugarGrams: null,
  limitSodiumMg: null,
  targetRateLbPerWeek: null,
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
    targetRateLbPerWeek:
      goals.targetRateLbPerWeek === null ||
      goals.targetRateLbPerWeek === undefined
        ? ''
        : String(goals.targetRateLbPerWeek),
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

function modeLabel(mode: TrackingMode): string {
  return trackingModeLabel(mode);
}

function goalLabel(value: GoalType): string {
  if (value === 'lose') return 'Lose';
  if (value === 'gain') return 'Gain';
  return 'Maintain';
}

function paceLabel(value: GoalPace | 'none'): string {
  if (value === 'none') return 'No pace';
  return label(value);
}

function IconDot({
  Icon,
  color = colors.light.ink,
  filled = false,
}: {
  Icon: SettingsIcon;
  color?: string;
  filled?: boolean;
}) {
  return (
    <View
      className={`h-9 w-9 items-center justify-center rounded-full ${
        filled ? 'bg-primary' : 'bg-[#F4F4F4]'
      }`}
    >
      <Icon color={filled ? '#FFFFFF' : color} size={16} strokeWidth={2.2} />
    </View>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-2.5">
      <View className="gap-1">
        <AppText
          variant="caption"
          className="text-ink uppercase tracking-[1.3px]"
        >
          {title}
        </AppText>
        {description === undefined ? null : (
          <AppText variant="caption" className="text-muted">
            {description}
          </AppText>
        )}
      </View>
      <View>{children}</View>
    </View>
  );
}

function SettingsRow({
  Icon,
  color = colors.light.ink,
  label: rowLabel,
  value,
  detail,
}: {
  Icon: SettingsIcon;
  color?: string;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <View className="flex-row items-center gap-3 border-t border-line py-4">
      <IconDot Icon={Icon} color={color} />
      <View className="min-w-0 flex-1 gap-0.5">
        <AppText variant="label" className="text-ink">
          {rowLabel}
        </AppText>
        {detail === undefined ? null : (
          <AppText variant="caption" className="text-muted">
            {detail}
          </AppText>
        )}
      </View>
      <AppText variant="label" className="text-right text-ink tabular-nums">
        {value}
      </AppText>
    </View>
  );
}

function StatusNotice({
  tone,
  title,
  message,
}: {
  tone: 'success' | 'warning';
  title: string;
  message: string;
}) {
  const success = tone === 'success';

  return (
    <View className="flex-row items-start gap-3 border-t border-line py-4">
      <IconDot
        Icon={success ? CheckCircle2 : CircleAlert}
        color={success ? '#679C8C' : '#A87962'}
      />
      <View className="min-w-0 flex-1 gap-1">
        <AppText variant="label" className="text-ink">
          {title}
        </AppText>
        <AppText muted>{message}</AppText>
      </View>
    </View>
  );
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
    <View className="flex-row flex-wrap gap-x-2 gap-y-2">
      {values.map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`min-h-[38px] rounded-full px-3.5 py-2 active:opacity-75 ${
              selected ? 'bg-primary' : 'bg-[#F4F4F4]'
            }`}
            onPress={() => onChange(option)}
          >
            <AppText
              variant="label"
              className={selected ? 'text-white' : 'text-ink'}
            >
              {label(option)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function ModeOption({
  mode,
  selected,
  onSelect,
}: {
  mode: TrackingMode;
  selected: boolean;
  onSelect: (value: TrackingMode) => void;
}) {
  const simple = mode === 'simple';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full px-3 py-2 active:opacity-75 ${
        selected ? 'bg-primary' : 'bg-transparent'
      }`}
      onPress={() => onSelect(mode)}
    >
      <AppLogo mode={simple ? 'simple' : 'complex'} size={24} />
      <AppText variant="label" className={selected ? 'text-white' : 'text-ink'}>
        {trackingModeLabel(simple ? 'simple' : 'complex')}
      </AppText>
    </Pressable>
  );
}

function ProfileActions({
  saving,
  canCancel,
  onSave,
  onCancel,
}: {
  saving: boolean;
  canCancel: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <View className="gap-3 border-t border-line pt-5">
      <Pressable
        accessibilityRole="button"
        className={`min-h-12 items-center justify-center rounded-full bg-primary px-5 py-3 active:opacity-75 ${
          saving ? 'opacity-70' : ''
        }`}
        disabled={saving}
        onPress={onSave}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <AppText variant="label" className="text-white">
            Save changes
          </AppText>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        className={`min-h-10 items-center justify-center rounded-full px-5 py-2 active:opacity-70 ${
          canCancel && !saving ? '' : 'opacity-40'
        }`}
        disabled={!canCancel || saving}
        onPress={onCancel}
      >
        <AppText variant="label" className="text-muted">
          Cancel
        </AppText>
      </Pressable>
    </View>
  );
}

function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-3.5 border-t border-line py-4">
      <View className="gap-1">
        <AppText variant="label" className="text-ink">
          {title}
        </AppText>
        {description === undefined ? null : (
          <AppText variant="caption" className="text-muted">
            {description}
          </AppText>
        )}
      </View>
      {children}
    </View>
  );
}

function ProfileOverview({ values }: { values: ProfileForm }) {
  const displayName =
    values.name.trim() === '' ? 'Your profile' : values.name.trim();
  const isSimple = values.mode === 'simple';

  return (
    <View className="border-b border-line pb-4">
      <View className="flex-row items-center gap-3">
        <AppLogo mode={isSimple ? 'simple' : 'complex'} size={42} />
        <View className="min-w-0 flex-1 gap-1">
          <AppText variant="heading" className="text-ink" numberOfLines={1}>
            {displayName}
          </AppText>
          <AppText variant="caption" className="text-muted">
            {isSimple
              ? 'Fast, focused tracking is active.'
              : 'Complex tracking is active.'}
          </AppText>
        </View>
        <View className="rounded-full bg-primary px-3 py-1.5">
          <AppText variant="caption" className="font-semibold text-white">
            {modeLabel(values.mode)} mode
          </AppText>
        </View>
      </View>
    </View>
  );
}

function ProfileSkeleton() {
  return (
    <AppScreen contentClassName="gap-7 pb-8" backgroundColor="#FFFFFF">
      <View className="border-b border-line pb-4">
        <View className="flex-row items-center gap-3">
          <SkeletonPill width={42} height={42} />
          <View className="min-w-0 flex-1 gap-2">
            <SkeletonLine width="58%" height={22} />
            <SkeletonLine width="72%" height={11} />
          </View>
          <SkeletonPill width={96} height={30} />
        </View>
      </View>

      <View className="gap-2.5">
        <View className="gap-2">
          <SkeletonLine width={112} height={11} />
          <SkeletonLine width="78%" height={10} />
        </View>
        <View className="gap-3 border-t border-line py-4">
          <View className="flex-row rounded-full bg-[#F4F4F4] p-1.5">
            <SkeletonPill width="50%" height={44} className="flex-1" />
            <SkeletonPill width="50%" height={44} className="flex-1" />
          </View>
          <SkeletonLine width="62%" height={10} />
        </View>
      </View>

      <View className="gap-2.5">
        <View className="gap-2">
          <SkeletonLine width={108} height={11} />
          <SkeletonLine width="70%" height={10} />
        </View>
        <View>
          {Array.from({ length: 4 }, (_, index) => (
            <View
              key={index}
              className="flex-row items-center gap-3 border-t border-line py-4"
            >
              <SkeletonPill width={36} height={36} />
              <View className="min-w-0 flex-1 gap-2">
                <SkeletonLine width="46%" height={13} />
                {index === 0 ? <SkeletonLine width="36%" height={10} /> : null}
              </View>
              <SkeletonLine width={82} height={14} />
            </View>
          ))}
        </View>
      </View>

      <View className="gap-2.5">
        <SkeletonLine width={92} height={11} />
        <View className="gap-3.5 border-t border-line py-4">
          <View className="gap-2">
            <SkeletonLine width={76} height={14} />
            <SkeletonLine width="80%" height={10} />
          </View>
          {Array.from({ length: 4 }, (_, index) => (
            <View key={index} className="gap-2">
              <SkeletonLine width={120} height={13} />
              <SkeletonRail height={46} radius={14} />
            </View>
          ))}
        </View>
      </View>
    </AppScreen>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const {
    deleteAccount,
    providerIds,
    reauthenticateWithGoogle,
    reauthenticateWithPassword,
    signOut,
  } = useAuthRuntime();
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [hasMissingData, setHasMissingData] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [savedPreferences, setSavedPreferences] =
    useState<TrackingPreferences>(defaultPreferences);
  const [lastSavedForm, setLastSavedForm] = useState<ProfileForm>(
    formValues(defaultProfile, defaultGoals, defaultPreferences),
  );

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileForm>({
    defaultValues: formValues(defaultProfile, defaultGoals, defaultPreferences),
  });

  const watchedValues = watch();

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
        const nextValues = formValues(
          profile.data,
          goals.data,
          preferences.data,
        );
        reset(nextValues);
        setLastSavedForm(nextValues);
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
          targetRateLbPerWeek:
            values.targetRateLbPerWeek.trim() === ''
              ? null
              : Number(values.targetRateLbPerWeek),
          targetCalories: Number(values.targetCalories),
          targetProteinGrams: Number(values.targetProteinGrams),
          targetOverrides:
            values.targetCalories !== lastSavedForm.targetCalories ||
            values.targetProteinGrams !== lastSavedForm.targetProteinGrams,
        }),
        api.trackingPreferences.update({
          mode: values.mode,
          waterTrackingEnabled: savedPreferences.waterTrackingEnabled,
        }),
      ]);
      const nextValues = formValues(profile, goals, preferences);
      reset(nextValues);
      setLastSavedForm(nextValues);
      setSavedPreferences(preferences);
      setHasMissingData(false);
      setNotice('Your preferences are saved.');
      markDataChanged();
      void syncLauncherIconToMode(preferences.mode).catch(() =>
        reportDiagnostic('launcher_icon_sync_failed', {
          operation: 'mode_icon_sync',
        }),
      );
    } catch (saveError) {
      setError(errorMessage(saveError));
    }
  });

  const cancelChanges = () => {
    reset(lastSavedForm);
    setError(null);
    setNotice(null);
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (error !== null && !hasLoaded) {
    return (
      <AppScreen backgroundColor="#FFFFFF">
        <ErrorState
          title="We couldn’t load your settings"
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
      contentClassName="gap-7 pb-8"
      backgroundColor="#FFFFFF"
    >
      {error === null ? null : (
        <ErrorState title="We couldn’t save your changes" message={error} />
      )}

      {hasMissingData ? (
        <StatusNotice
          tone="warning"
          title="Review your setup"
          message="Some settings were missing, so these fields use starting suggestions until you save them."
        />
      ) : null}

      {notice === null ? null : (
        <StatusNotice
          tone="success"
          title={notice}
          message="You can change this anytime."
        />
      )}

      <ProfileOverview values={watchedValues} />

      <SettingsSection
        title="Tracking style"
        description="Choose how detailed you want tracking to feel."
      >
        <Controller
          control={control}
          name="mode"
          render={({ field }) => (
            <View className="gap-3 border-t border-line py-4">
              <View className="flex-row rounded-full bg-[#F4F4F4] p-1.5">
                {TRACKING_MODES.map((mode) => (
                  <ModeOption
                    key={mode}
                    mode={mode}
                    selected={field.value === mode}
                    onSelect={field.onChange}
                  />
                ))}
              </View>
              <AppText variant="caption" className="text-muted">
                {field.value === 'simple'
                  ? 'Fast logging with core targets.'
                  : 'More nutrition detail when you want it.'}
              </AppText>
            </View>
          )}
        />
      </SettingsSection>

      <SettingsSection
        title="Plan summary"
        description="These values shape what you see across the app."
      >
        <SettingsRow
          Icon={Goal}
          label="Goal direction"
          value={goalLabel(watchedValues.goalType)}
          detail={paceLabel(watchedValues.goalPace)}
        />
        <SettingsRow
          Icon={Scale}
          color="#6F88B4"
          label="Target weight"
          value={`${watchedValues.targetWeightLb || '0'} lb`}
        />
        <SettingsRow
          Icon={Flame}
          color="#D98275"
          label="Daily calories"
          value={`${Number(watchedValues.targetCalories || 0).toLocaleString()} kcal`}
        />
        <SettingsRow
          Icon={Beef}
          color="#679C8C"
          label="Daily protein"
          value={`${watchedValues.targetProteinGrams || '0'} g`}
        />
        <Pressable
          accessibilityLabel="Edit daily nutrition targets"
          accessibilityRole="button"
          className="rounded-full bg-primary-soft px-4 py-3"
          onPress={() =>
            router.push({ pathname: '/nutrition-targets' } as never)
          }
        >
          <AppText variant="label">Edit daily nutrition targets</AppText>
        </Pressable>
        <Pressable
          accessibilityLabel="Review goal plan"
          accessibilityRole="button"
          className="rounded-full bg-primary-soft px-4 py-3"
          onPress={() => router.push({ pathname: '/goal-plan' } as never)}
        >
          <AppText variant="label">Review goal plan</AppText>
        </Pressable>
      </SettingsSection>

      <SettingsSection title="Edit profile">
        <FieldGroup
          title="Identity"
          description="Personal details help keep your daily targets useful."
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
        </FieldGroup>

        <FieldGroup title="Body and training">
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
        </FieldGroup>

        <FieldGroup title="App context">
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
        </FieldGroup>
      </SettingsSection>

      <SettingsSection title="Edit goals">
        <FieldGroup
          title="Goal"
          description="Use values that feel practical right now."
        >
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
            name="targetRateLbPerWeek"
            rules={{
              validate: (value) =>
                value.trim() === '' || (Number(value) > 0 && Number(value) <= 2)
                  ? true
                  : 'Enter a rate from 0.25 to 2 lb/week.',
            }}
            render={({ field }) => (
              <AppInput
                label="Weekly rate (lb/week, optional)"
                keyboardType="decimal-pad"
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={errors.targetRateLbPerWeek?.message}
              />
            )}
          />
        </FieldGroup>

        <FieldGroup title="Daily targets">
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
        </FieldGroup>
      </SettingsSection>

      <SettingsSection
        title="Preferences"
        description="Fixed units are shown where they apply."
      >
        <SettingsRow
          Icon={Ruler}
          color="#6F88B4"
          label="Height"
          value="Inches"
          detail="Used for profile details"
        />
        <SettingsRow
          Icon={Scale}
          color="#6F88B4"
          label="Weight"
          value="Pounds"
          detail="Used for weight and target fields"
        />
        <SettingsRow
          Icon={MapPin}
          label="Timezone"
          value={watchedValues.timezone}
          detail="Keeps daily logs aligned"
        />
        <SettingsRow
          Icon={SlidersHorizontal}
          label="Tracking mode"
          value={modeLabel(watchedValues.mode)}
          detail={
            watchedValues.mode === 'simple'
              ? 'Fast and focused'
              : 'Complex but organized'
          }
        />
        <SettingsRow
          Icon={Activity}
          label="Activity"
          value={label(watchedValues.activityLevel)}
        />
        <SettingsRow
          Icon={Dumbbell}
          label="Training"
          value={label(watchedValues.trainingStyle)}
        />
        <SettingsRow
          Icon={CalendarDays}
          label="Birthday"
          value={watchedValues.birthDate}
        />
        <SettingsRow
          Icon={UserRound}
          label="Profile"
          value={label(watchedValues.sex)}
        />
        <SettingsRow
          Icon={Target}
          label="Goal pace"
          value={paceLabel(watchedValues.goalPace)}
        />
      </SettingsSection>

      <ProfileActions
        saving={isSubmitting}
        canCancel={isDirty}
        onSave={() => void save()}
        onCancel={cancelChanges}
      />

      <SettingsSection
        title="Notifications"
        description="Choose when Food Tracker can surface a private insight or logging reminder."
      >
        <Pressable
          className="rounded-full bg-primary-soft px-4 py-3"
          disabled={notificationsBusy}
          onPress={() => {
            setNotificationsBusy(true);
            void registerPushInstallation()
              .then(async (registered) => {
                if (registered) {
                  await api.notifications.preferences.update({
                    recommendationInsightsEnabled: true,
                    loggingRemindersEnabled: true,
                  });
                }
                setNotice(
                  registered
                    ? 'Notifications are enabled on this device.'
                    : 'Notifications need a physical device and permission.',
                );
              })
              .catch((registrationError) =>
                setError(errorMessage(registrationError)),
              )
              .finally(() => setNotificationsBusy(false));
          }}
        >
          <AppText variant="label">Enable notifications on this device</AppText>
        </Pressable>
      </SettingsSection>

      <SettingsSection
        title="Account"
        description="Your data stays separated from other accounts on this device."
      >
        <AccountSignOutButton onSignOut={signOut} />
        <DeleteAccountPanel
          providerIds={providerIds}
          actions={
            {
              deleteAccount,
              reauthenticateWithGoogle,
              reauthenticateWithPassword,
            } satisfies AccountDeletionActions
          }
        />
      </SettingsSection>
    </AppScreen>
  );
}
