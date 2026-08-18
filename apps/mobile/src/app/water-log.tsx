import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DEFAULT_TIMEZONE, type WaterLog } from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import {
  isValidLocalDate,
  isValidLocalTime,
  dateTimeFieldsInTimezone,
  zonedDateTimeToIso,
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
    dateTimeFieldsInTimezone(new Date().toISOString(), DEFAULT_TIMEZONE),
  );
  const [loadingRecord, setLoadingRecord] = useState(isEditing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [todayWaterLogs, setTodayWaterLogs] = useState<WaterLog[]>([]);
  const [todayTotalMl, setTodayTotalMl] = useState<number | null>(null);
  const [dailyWaterGoalMl, setDailyWaterGoalMl] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const recordRequestId = useRef(0);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<WaterForm>({
    defaultValues: {
      amountMl: initialAmount || (isEditing ? '' : '250'),
      loggedDate: initialTimestamp.date,
      loggedTime: initialTimestamp.time,
    },
  });
  const amountMl = watch('amountMl');
  const [customAmountOpen, setCustomAmountOpen] = useState(
    initialAmount !== '' &&
      !['250', '350', '500', '750'].includes(initialAmount),
  );
  const [timeOpen, setTimeOpen] = useState(isEditing);
  const amountPresets = ['250', '350', '500', '750'] as const;

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/history');
  };

  const returnToHistory = () => {
    markDataChanged();
    router.replace('/(tabs)/history');
  };

  const loadRecord = useCallback(async () => {
    if (editId === null || timezone === null) return;
    const requestId = ++recordRequestId.current;
    const isCurrent = () => requestId === recordRequestId.current;
    setLoadingRecord(true);
    setLoadError(null);
    try {
      const waterLog = await api.waterLogs.getById(editId);
      if (!isCurrent()) return;
      const timestamp = dateTimeFieldsInTimezone(waterLog.loggedAt, timezone);
      reset({
        amountMl: String(waterLog.amountMl),
        loggedDate: timestamp.date,
        loggedTime: timestamp.time,
      });
    } catch (error) {
      if (!isCurrent()) return;
      setLoadError(errorMessage(error));
    } finally {
      if (isCurrent()) setLoadingRecord(false);
    }
  }, [editId, reset, timezone]);

  useEffect(() => {
    void loadRecord();
  }, [loadRecord]);

  const loadTodayWater = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const insights = await api.analytics.insights('week');
      const hydration = insights.overview.hydration;
      if (hydration.status !== 'available' || hydration.data === null) {
        throw new Error('Hydration overview unavailable');
      }
      const logs = await api.waterLogs.list({ date: hydration.data.today });
      setTimezone(hydration.data.timezone);
      setDailyWaterGoalMl(hydration.data.goal);
      setTodayTotalMl(hydration.data.total);
      setTodayWaterLogs(logs);
      if (isEditing) setLoadError(null);
      if (!isEditing) {
        const timestamp = dateTimeFieldsInTimezone(
          new Date().toISOString(),
          hydration.data.timezone,
        );
        setValue('loggedDate', timestamp.date);
        setValue('loggedTime', timestamp.time);
      }
    } catch {
      setHistoryError('Today’s water history is temporarily unavailable.');
      if (isEditing) {
        setLoadError('Water entry time zone is temporarily unavailable.');
        setLoadingRecord(false);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, [isEditing, setValue]);

  useEffect(() => {
    void loadTodayWater();
  }, [loadTodayWater]);

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    if (timezone === null) {
      setSubmitError(
        'Hydration context is temporarily unavailable. Try again before saving.',
      );
      return;
    }
    const amountMl = Number(values.amountMl);
    const loggedAt = zonedDateTimeToIso(
      values.loggedDate,
      values.loggedTime,
      timezone,
    );
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close water logger"
              className="min-h-11 justify-center"
              onPress={close}
            >
              <AppText>Close</AppText>
            </Pressable>
          }
        />
        <ErrorState
          title="Water entry is unavailable"
          message={loadError}
          onRetry={() => void loadTodayWater()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      presentation="bottom-sheet"
      testID="water-log-bottom-sheet"
      backgroundColor="#FFFFFF"
      contentClassName="gap-6 bg-white"
      footer={
        <View className="gap-2">
          <AppButton
            loading={isSubmitting}
            disabled={deleting || timezone === null}
            onPress={() => void submit()}
          >
            {isEditing ? 'Save changes' : `Add ${amountMl || '0'} mL`}
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
      <View className="h-1 w-[58px] self-center rounded-full bg-[#C7C7BF]" />
      <ScreenHeader
        title={isEditing ? 'Edit water' : 'Log water'}
        subtitle={undefined}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close water logger"
            className="min-h-11 justify-center"
            onPress={close}
          >
            <AppText variant="label">Done</AppText>
          </Pressable>
        }
      />
      {submitError === null ? null : (
        <ErrorState
          title="Please check this water entry"
          message={submitError}
        />
      )}
      {isEditing ? (
        <WaterProgressVisual totalMl={todayTotalMl} goalMl={dailyWaterGoalMl} />
      ) : null}
      <View className="gap-3">
        <AppText variant="caption" className="font-bold uppercase text-muted">
          Amount
        </AppText>
        <View className="flex-row flex-wrap gap-2">
          {amountPresets.map((preset) => (
            <Pressable
              key={preset}
              accessibilityRole="button"
              accessibilityLabel={`${preset} mL`}
              accessibilityState={{ selected: amountMl === preset }}
              className={`min-h-11 rounded-full border px-4 py-3 ${amountMl === preset ? 'border-ink bg-ink' : 'border-border bg-surface'}`}
              onPress={() => {
                setValue('amountMl', preset, { shouldValidate: true });
                setCustomAmountOpen(false);
              }}
            >
              <AppText
                className={amountMl === preset ? 'text-white' : 'text-ink'}
              >
                {preset} mL
              </AppText>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open other water amount"
          className="min-h-[62px] flex-row items-center justify-between rounded-[16px] bg-module px-4"
          style={{ backgroundColor: '#F5F5F2' }}
          onPress={() => setCustomAmountOpen((open) => !open)}
        >
          <AppText muted>Other amount</AppText>
          <AppText variant="label">
            {customAmountOpen ? 'Close' : 'Enter'} ›
          </AppText>
        </Pressable>
        {customAmountOpen ? (
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
        ) : null}
      </View>
      <View className="gap-3">
        <AppText variant="caption" className="font-bold uppercase text-muted">
          Logged at
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open water time"
          className="min-h-[62px] flex-row items-center justify-between rounded-[16px] bg-module px-4"
          style={{ backgroundColor: '#F5F5F2' }}
          onPress={() => setTimeOpen((open) => !open)}
        >
          <AppText>Time</AppText>
          <AppText variant="label">{isEditing ? 'Edit' : 'Now'} ›</AppText>
        </Pressable>
        {timeOpen ? (
          <AppCard className="gap-3 bg-module">
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
          </AppCard>
        ) : null}
      </View>
      {isEditing ? (
        <View className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <AppText variant="label">Today’s water</AppText>
            <AppText variant="caption" muted>
              {todayTotalMl === null ? '—' : `${todayTotalMl} mL`}
            </AppText>
          </View>
          {historyLoading ? (
            <AppText muted>Loading water history…</AppText>
          ) : historyError !== null ? (
            <ErrorState
              message={historyError}
              onRetry={() => void loadTodayWater()}
            />
          ) : timezone === null ? (
            <AppText muted>
              Hydration context is temporarily unavailable. Try again to view or
              edit today’s water entries.
            </AppText>
          ) : todayWaterLogs.length === 0 ? (
            <AppText muted>No water logged today.</AppText>
          ) : (
            todayWaterLogs.map((waterLog) => {
              const time = dateTimeFieldsInTimezone(
                waterLog.loggedAt,
                timezone,
              ).time;
              return (
                <Pressable
                  key={waterLog.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${waterLog.amountMl} mL water at ${time}`}
                  className="min-h-[58px] flex-row items-center justify-between rounded-[16px] bg-module px-4"
                  onPress={() =>
                    router.push(
                      `/water-log?id=${encodeURIComponent(waterLog.id)}` as never,
                    )
                  }
                >
                  <AppText>{time}</AppText>
                  <AppText variant="label">{waterLog.amountMl} mL</AppText>
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
      <AppCard
        className="gap-1 border-0 bg-[#EAF4FF]"
        style={{ backgroundColor: '#EAF4FF', borderColor: 'transparent' }}
      >
        <AppText variant="label">Counts toward hydration</AppText>
        <AppText variant="caption" muted>
          Only explicitly logged drinks count. Water contained in foods is
          excluded.
        </AppText>
      </AppCard>
    </AppScreen>
  );
}

function WaterProgressVisual({
  totalMl,
  goalMl,
}: {
  totalMl: number | null;
  goalMl: number | null;
}) {
  const ratio =
    totalMl === null || goalMl === null || goalMl <= 0
      ? 0
      : Math.min(totalMl / goalMl, 1);
  return (
    <AppCard testID="water-progress-visual" className="gap-3 bg-[#EAF4FF]">
      <View className="flex-row items-end justify-between gap-3">
        <View className="gap-1">
          <AppText variant="caption" className="font-bold uppercase text-muted">
            Hydration today
          </AppText>
          <AppText variant="title">
            {totalMl === null ? '—' : `${totalMl} mL`}
          </AppText>
        </View>
        <AppText variant="label">
          Goal {goalMl === null ? '—' : `${goalMl} mL`}
        </AppText>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Hydration goal progress"
        accessibilityValue={
          goalMl === null
            ? undefined
            : totalMl === null
              ? { min: 0, max: goalMl }
              : { min: 0, max: goalMl, now: totalMl }
        }
        className="h-3 overflow-hidden rounded-full bg-white"
      >
        <View
          className="h-full rounded-full bg-[#1C6E8C]"
          style={{ width: `${ratio * 100}%` }}
        />
      </View>
      <AppText variant="caption" muted>
        Only explicitly logged drinks count toward this total.
      </AppText>
    </AppCard>
  );
}
