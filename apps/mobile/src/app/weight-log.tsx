import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { FormSection } from '@/components/form-section';
import { ScreenHeader } from '@/components/screen-header';
import {
  SkeletonLine,
  SkeletonPill,
  SkeletonRail,
} from '@/components/skeleton';
import { api, errorMessage } from '@/lib/api-client';
import {
  isValidLocalDate,
  isValidLocalTime,
  localDateTimeFields,
  localDateTimeToIso,
} from '@/lib/date-time';
import { useAppStore } from '@/store/app-store';

interface WeightForm {
  weightLb: string;
  loggedDate: string;
  loggedTime: string;
}

function WeightLogSkeleton() {
  return (
    <AppScreen
      contentClassName="gap-6 pb-8"
      footer={
        <View className="gap-2">
          <SkeletonRail height={52} />
          <SkeletonRail height={52} />
        </View>
      }
    >
      <ScreenHeader
        title="Edit weight"
        subtitle="Review and correct this measurement."
        action={<SkeletonPill width={68} height={36} />}
      />

      <View className="gap-4">
        <View className="gap-2">
          <SkeletonLine width={128} height={22} />
          <SkeletonLine width="70%" height={11} />
        </View>
        <SkeletonRail height={58} radius={14} />
      </View>

      <View className="gap-4">
        <View className="gap-2">
          <SkeletonLine width={112} height={22} />
          <SkeletonLine width="58%" height={11} />
        </View>
        <SkeletonRail height={58} radius={14} />
        <SkeletonRail height={58} radius={14} />
      </View>
    </AppScreen>
  );
}

export default function WeightLogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const editId = typeof params.id === 'string' ? params.id : null;
  const isEditing = editId !== null;
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [initialTimestamp] = useState(() =>
    localDateTimeFields(new Date().toISOString()),
  );
  const [loadingRecord, setLoadingRecord] = useState(isEditing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WeightForm>({
    defaultValues: {
      weightLb: '',
      loggedDate: initialTimestamp.date,
      loggedTime: initialTimestamp.time,
    },
  });

  const loadRecord = useCallback(async () => {
    if (editId === null) {
      return;
    }

    setLoadingRecord(true);
    setLoadError(null);
    try {
      const weightLog = await api.weightLogs.getById(editId);
      const timestamp = localDateTimeFields(weightLog.loggedAt);
      reset({
        weightLb: String(weightLog.weightLb),
        loggedDate: timestamp.date,
        loggedTime: timestamp.time,
      });
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoadingRecord(false);
    }
  }, [editId, reset]);

  useEffect(() => {
    void loadRecord();
  }, [loadRecord]);

  const returnToHistory = () => {
    markDataChanged();
    router.replace('/(tabs)/history');
  };

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    const loggedAt = localDateTimeToIso(values.loggedDate, values.loggedTime);

    if (loggedAt === null) {
      setSubmitError('Choose a valid date and time.');
      return;
    }

    const input = {
      weightLb: Number(values.weightLb),
      loggedAt,
    };

    try {
      if (editId === null) {
        await api.weightLogs.create(input);
      } else {
        await api.weightLogs.update(editId, input);
      }
      returnToHistory();
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  });

  const deleteRecord = async () => {
    if (editId === null) {
      return;
    }

    setDeleting(true);
    setSubmitError(null);
    try {
      await api.weightLogs.delete(editId);
      returnToHistory();
    } catch (error) {
      setSubmitError(errorMessage(error));
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    if (Platform.OS === 'web') {
      if (
        globalThis.confirm(
          'Delete weight entry?\n\nThis removes the entry from history and future analytics.',
        )
      ) {
        void deleteRecord();
      }
      return;
    }

    Alert.alert(
      'Delete weight entry?',
      'This removes the entry from history and future analytics.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteRecord(),
        },
      ],
    );
  };

  if (loadingRecord) {
    return <WeightLogSkeleton />;
  }

  if (loadError !== null) {
    return (
      <AppScreen>
        <ScreenHeader
          title="Edit weight"
          subtitle="Review and correct this measurement."
          action={
            <Pressable
              accessibilityRole="button"
              className="rounded-full bg-surface px-3.5 py-2"
              onPress={() => router.back()}
            >
              <AppText variant="label" className="text-sage-dark">
                Close
              </AppText>
            </Pressable>
          }
        />
        <ErrorState
          title="Weight entry is unavailable"
          message={loadError}
          onRetry={() => void loadRecord()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      contentClassName="gap-6 pb-8"
      footer={
        <View className="gap-2">
          <AppButton
            loading={isSubmitting}
            disabled={deleting}
            onPress={() => void submit()}
          >
            {isEditing ? 'Save changes' : 'Save weight'}
          </AppButton>
          {isEditing ? (
            <AppButton
              variant="danger"
              loading={deleting}
              disabled={isSubmitting}
              onPress={confirmDelete}
            >
              Delete weight entry
            </AppButton>
          ) : null}
        </View>
      }
    >
      <ScreenHeader
        title={isEditing ? 'Edit weight' : 'Log weight'}
        subtitle={
          isEditing
            ? 'Review and correct this measurement.'
            : 'Add a weight entry for your record.'
        }
        action={
          <Pressable
            accessibilityRole="button"
            className="rounded-full bg-surface px-3.5 py-2"
            onPress={() => router.back()}
          >
            <AppText variant="label" className="text-sage-dark">
              Close
            </AppText>
          </Pressable>
        }
      />

      {submitError === null ? null : (
        <ErrorState
          title="Please check your weight entry"
          message={submitError}
        />
      )}

      <FormSection
        title="Measurement"
        description="Use pounds for now. You can update this entry anytime."
        variant="open"
      >
        <Controller
          control={control}
          name="weightLb"
          rules={{
            required: 'Weight is required.',
            validate: (value) =>
              Number(value) > 0 ? true : 'Enter a weight above zero.',
          }}
          render={({ field }) => (
            <AppInput
              label="Weight (lb)"
              autoFocus={!isEditing}
              keyboardType="decimal-pad"
              placeholder="181.4"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.weightLb?.message}
            />
          )}
        />
      </FormSection>

      <FormSection
        title="Date and time"
        description="Use the time you weighed in."
        variant="open"
      >
        <Controller
          control={control}
          name="loggedDate"
          rules={{
            required: 'Date is required.',
            validate: (value) =>
              isValidLocalDate(value) ? true : 'Use YYYY-MM-DD.',
          }}
          render={({ field }) => (
            <AppInput
              label="Date"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              placeholder="2026-06-22"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.loggedDate?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="loggedTime"
          rules={{
            required: 'Time is required.',
            validate: (value) =>
              isValidLocalTime(value) ? true : 'Use 24-hour HH:mm.',
          }}
          render={({ field }) => (
            <AppInput
              label="Time"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              placeholder="08:15"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.loggedTime?.message}
              hint="24-hour format"
            />
          )}
        />
      </FormSection>
    </AppScreen>
  );
}
