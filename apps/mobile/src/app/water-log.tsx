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
import { api, errorMessage } from '@/lib/api-client';
import {
  isValidLocalDate,
  isValidLocalTime,
  localDateTimeFields,
  localDateTimeToIso,
} from '@/lib/date-time';
import { useAppStore } from '@/store/app-store';

interface WaterForm {
  amountMl: string;
  loggedDate: string;
  loggedTime: string;
}

export default function WaterLogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
    amountMl?: string | string[];
  }>();
  const editId = typeof params.id === 'string' ? params.id : null;
  const initialAmount =
    typeof params.amountMl === 'string' ? params.amountMl : '';
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
  } = useForm<WaterForm>({
    defaultValues: {
      amountMl: initialAmount,
      loggedDate: initialTimestamp.date,
      loggedTime: initialTimestamp.time,
    },
  });

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/history');
  };

  const returnToHistory = () => {
    markDataChanged();
    router.replace('/(tabs)/history');
  };

  const loadRecord = useCallback(async () => {
    if (editId === null) return;
    setLoadingRecord(true);
    setLoadError(null);
    try {
      const waterLog = await api.waterLogs.getById(editId);
      const timestamp = localDateTimeFields(waterLog.loggedAt);
      reset({
        amountMl: String(waterLog.amountMl),
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

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    const amountMl = Number(values.amountMl);
    const loggedAt = localDateTimeToIso(values.loggedDate, values.loggedTime);
    if (loggedAt === null) {
      setSubmitError('Choose a valid date and time.');
      return;
    }
    try {
      if (editId === null) await api.waterLogs.create({ amountMl, loggedAt });
      else await api.waterLogs.update(editId, { amountMl, loggedAt });
      returnToHistory();
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  });

  const deleteRecord = async () => {
    if (editId === null) return;
    setDeleting(true);
    try {
      await api.waterLogs.delete(editId);
      returnToHistory();
    } catch (error) {
      setSubmitError(errorMessage(error));
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    const proceed = () => void deleteRecord();
    if (Platform.OS === 'web') {
      if (globalThis.confirm('Delete water entry?')) proceed();
      return;
    }
    Alert.alert(
      'Delete water entry?',
      'This removes the water entry from hydration history.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: proceed },
      ],
    );
  };

  if (loadingRecord)
    return (
      <AppScreen>
        <AppText>Loading water entry…</AppText>
      </AppScreen>
    );
  if (loadError !== null) {
    return (
      <AppScreen>
        <ScreenHeader
          title="Water entry"
          action={
            <Pressable onPress={close}>
              <AppText>Close</AppText>
            </Pressable>
          }
        />
        <ErrorState
          title="Water entry is unavailable"
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
            {isEditing ? 'Save changes' : 'Log water'}
          </AppButton>
          {isEditing ? (
            <AppButton
              variant="danger"
              loading={deleting}
              disabled={isSubmitting}
              onPress={confirmDelete}
            >
              Delete water entry
            </AppButton>
          ) : null}
        </View>
      }
    >
      <ScreenHeader
        title={isEditing ? 'Edit water' : 'Log water'}
        subtitle="Record water you explicitly drank. Food water is not included."
        action={
          <Pressable
            accessibilityRole="button"
            className="rounded-full bg-surface px-3.5 py-2"
            onPress={close}
          >
            <AppText variant="label" className="text-sage-dark">
              Close
            </AppText>
          </Pressable>
        }
      />
      {submitError === null ? null : (
        <ErrorState
          title="Please check this water entry"
          message={submitError}
        />
      )}
      <FormSection
        title="Amount"
        description="Enter millilitres of water."
        variant="open"
      >
        <Controller
          control={control}
          name="amountMl"
          rules={{
            required: 'Amount is required.',
            validate: (value) =>
              Number.isInteger(Number(value)) &&
              Number(value) >= 1 &&
              Number(value) <= 5000
                ? true
                : 'Enter 1 to 5,000 mL.',
          }}
          render={({ field }) => (
            <AppInput
              label="Water (mL)"
              autoFocus={!isEditing}
              keyboardType="number-pad"
              placeholder="250"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.amountMl?.message}
            />
          )}
        />
      </FormSection>
      <FormSection
        title="Date and time"
        description="Use the time you drank it."
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
              keyboardType="numbers-and-punctuation"
              placeholder="2026-08-08"
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
              keyboardType="numbers-and-punctuation"
              placeholder="14:30"
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
