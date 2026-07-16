import { useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  DEFAULT_TIMEZONE,
  MEAL_TYPES,
  type MealType,
} from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import { cleanupPhotoFiles } from '@/lib/photo-image';
import {
  ApiClientError,
  api,
  errorMessage,
  PHOTO_CONFIRMATION_CLIENT_TIMEOUT_MS,
} from '@/lib/api-client';
import {
  markPhotoRowUnresolved,
  photoCandidateName,
  photoRowServingPreview,
  photoRowsDisposition,
  photoRowsMixedConfirmationRequest,
} from '@/lib/photo-log-ui';
import { safePhotoLogBack } from '@/lib/photo-log-navigation';
import { dateTimeFieldsInTimezone, zonedDateTimeToIso } from '@/lib/date-time';
import { useAppStore } from '@/store/app-store';

const PROOF_ERROR_COPY: Record<string, string> = {
  EXPIRED_ESTIMATE_PROOF:
    'This estimate has expired. Analyze the photo again before saving.',
  INVALID_ESTIMATE_PROOF:
    'This estimate is no longer valid. Analyze the photo again before saving.',
  ESTIMATE_PROOF_USER_MISMATCH:
    'This estimate is not available for the current account. Analyze the photo again.',
  ESTIMATE_CONFIRMATION_DISABLED:
    'Estimate confirmation is unavailable. Analyze the photo again or choose a trusted match.',
};

function entryIndexFromError(error: ApiClientError): number | null {
  const value = error.details.entryIndex;
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function isProofError(code: string): boolean {
  return code in PROOF_ERROR_COPY;
}

function isAmbiguousNetworkError(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    (error.code === 'NETWORK_ERROR' || error.code === 'NETWORK_TIMEOUT')
  );
}

export default function PhotoLogConfirmScreen() {
  const router = useRouter();
  const session = useAppStore((state) => state.photoLogSession);
  const clearSession = useAppStore((state) => state.clearPhotoLogSession);
  const setRows = useAppStore((state) => state.setPhotoLogRows);
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [date, setDate] = useState(
    () => dateTimeFieldsInTimezone(new Date(), DEFAULT_TIMEZONE).date,
  );
  const [time, setTime] = useState(
    () => dateTimeFieldsInTimezone(new Date(), DEFAULT_TIMEZONE).time,
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ambiguousFailure, setAmbiguousFailure] = useState(false);
  const [needsAnalysisAgain, setNeedsAnalysisAgain] = useState(false);
  const singleFlight = useRef(false);

  if (session === null) return null;
  const disposition = photoRowsDisposition(session.rows);
  const loggedAt = zonedDateTimeToIso(date, time, DEFAULT_TIMEZONE);

  const save = async () => {
    if (singleFlight.current || saving || !disposition.canContinue) return;
    if (loggedAt === null) {
      setError('Choose a valid date and time before saving.');
      return;
    }
    singleFlight.current = true;
    setSaving(true);
    setError(null);
    setAmbiguousFailure(false);
    setNeedsAnalysisAgain(false);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      PHOTO_CONFIRMATION_CLIENT_TIMEOUT_MS,
    );
    try {
      const request = photoRowsMixedConfirmationRequest({
        rows: session.rows,
        mealType,
        loggedAt,
        notes: notes.trim() === '' ? null : notes.trim(),
      });
      const response = await api.foodLogs.confirmPhotoAnalysisEntries(
        request,
        controller.signal,
      );
      await cleanupPhotoFiles([
        { uri: session.normalizedUri, ownership: 'app_normalized' },
        { uri: session.originalUri, ownership: session.originalOwnership },
      ]);
      clearSession();
      markDataChanged();
      router.dismissAll();
      Alert.alert(
        'Photo foods saved',
        `${response.createdTrustedCount + response.createdEstimatedCount} food log${response.createdTrustedCount + response.createdEstimatedCount === 1 ? '' : 's'} created. ${response.excludedCount} excluded.`,
      );
    } catch (cause) {
      if (cause instanceof ApiClientError) {
        const entryIndex = entryIndexFromError(cause);
        if (isProofError(cause.code)) {
          const message =
            PROOF_ERROR_COPY[cause.code] ??
            'This estimate is no longer available. Analyze the photo again before saving.';
          if (entryIndex !== null && session.rows[entryIndex] !== undefined) {
            setRows(
              session.rows.map((row, index) =>
                index === entryIndex
                  ? markPhotoRowUnresolved(row, message, {
                      estimateProofUnavailable: true,
                    })
                  : row,
              ),
            );
          }
          setNeedsAnalysisAgain(true);
          setError(message);
        } else if (cause.code === 'INVALID_TRUSTED_CANDIDATE') {
          const message =
            'This trusted match is no longer available. Choose another saved match, use the estimate, or exclude the row.';
          if (entryIndex !== null && session.rows[entryIndex] !== undefined) {
            setRows(
              session.rows.map((row, index) =>
                index === entryIndex
                  ? markPhotoRowUnresolved(row, message)
                  : row,
              ),
            );
          }
          setError(message);
        } else {
          setError(
            errorMessage(
              cause,
              'Nothing was saved. Correct the review and deliberately try again.',
            ),
          );
        }
      } else {
        setError(
          errorMessage(
            cause,
            'Nothing was saved. Correct the review and deliberately try again.',
          ),
        );
      }
      setAmbiguousFailure(isAmbiguousNetworkError(cause));
      singleFlight.current = false;
      setSaving(false);
    } finally {
      clearTimeout(timeout);
    }
  };

  return (
    <AppScreen
      contentClassName="gap-5"
      footer={
        <AppButton
          loading={saving}
          disabled={saving || !disposition.canContinue || loggedAt === null}
          accessibilityHint={
            disposition.unresolved.length > 0
              ? 'Resolve every row before saving.'
              : undefined
          }
          onPress={() => void save()}
        >
          {saving ? 'Saving all reviewed foods' : 'Save all reviewed foods'}
        </AppButton>
      }
    >
      <ScreenHeader
        eyebrow="Photo logging"
        title="Save reviewed foods"
        subtitle="Trusted and estimated rows are sent together in one atomic confirmation. Excluded rows create no logs."
        action={
          <Pressable
            disabled={saving}
            onPress={() =>
              safePhotoLogBack({
                canGoBack: router.canGoBack,
                back: router.back,
                replace: router.replace,
                fallback: '/photo-log/review' as Href,
              })
            }
          >
            <AppText variant="label">Back</AppText>
          </Pressable>
        }
      />
      {error === null ? null : (
        <ErrorState
          title={ambiguousFailure ? 'Save result is unknown' : 'Save failed'}
          message={
            ambiguousFailure
              ? 'The save result could not be confirmed. Check History before trying again to avoid duplicate logs.'
              : error
          }
          onRetry={ambiguousFailure ? undefined : () => void save()}
          retryLabel="Deliberately try save again"
        />
      )}
      {ambiguousFailure ? (
        <AppButton
          variant="secondary"
          onPress={() => router.replace('/(tabs)/history' as Href)}
        >
          Check History
        </AppButton>
      ) : null}
      {needsAnalysisAgain ? (
        <AppButton
          variant="secondary"
          onPress={() => router.replace('/photo-log/review' as Href)}
        >
          Analyze again
        </AppButton>
      ) : null}
      <View className="gap-2 rounded-[26px] bg-module px-4 py-4">
        <AppText variant="label">Reviewed rows</AppText>
        {disposition.included.map((row) => {
          if (row.disposition === 'estimated') {
            const draft = row.estimateDraft;
            return (
              <View
                key={row.id}
                className="flex-row items-center justify-between gap-3 border-t border-line py-3"
              >
                <View className="min-w-0 flex-1">
                  <AppText variant="label" numberOfLines={1}>
                    {draft?.foodName ?? row.recognizedItem.recognizedName}
                  </AppText>
                  <AppText variant="caption" muted>
                    AI estimate · {row.recognizedItem.estimatedNutrition?.label}
                  </AppText>
                </View>
                <AppText variant="caption" muted>
                  {draft?.calories ?? '—'} kcal
                </AppText>
              </View>
            );
          }
          const preview = photoRowServingPreview(row);
          return (
            <View
              key={row.id}
              className="flex-row items-center justify-between gap-3 border-t border-line py-3"
            >
              <View className="min-w-0 flex-1">
                <AppText variant="label" numberOfLines={1}>
                  {photoCandidateName(
                    row.recognizedItem.candidates.find(
                      (candidate) =>
                        candidate.candidateType === 'food_item' &&
                        candidate.foodItem.id === row.selectedCandidateId,
                    ) ?? null,
                  )}
                </AppText>
                <AppText variant="caption" muted>
                  Trusted · {preview?.requestedServing?.quantity ?? '—'}{' '}
                  {preview?.requestedServing?.unit ?? ''}
                </AppText>
              </View>
              <AppText variant="caption" muted>
                {preview?.nutrition?.calories === null ||
                preview?.nutrition?.calories === undefined
                  ? 'Calories resolved on save'
                  : `${preview.nutrition.calories} kcal preview`}
              </AppText>
            </View>
          );
        })}
        {disposition.excluded.length === 0 ? null : (
          <AppText variant="caption" muted>
            {disposition.excluded.length} row
            {disposition.excluded.length === 1 ? '' : 's'} excluded and will
            create no logs.
          </AppText>
        )}
      </View>
      <View className="gap-3">
        <AppText variant="label">Meal</AppText>
        <View className="flex-row flex-wrap gap-2">
          {MEAL_TYPES.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: mealType === value }}
              className={`rounded-full px-3.5 py-2 ${mealType === value ? 'bg-primary' : 'bg-module'}`}
              onPress={() => setMealType(value)}
            >
              <AppText
                variant="caption"
                className={mealType === value ? 'text-white' : 'text-ink'}
              >
                {value.slice(0, 1).toUpperCase() + value.slice(1)}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <AppInput
            label="Logged date"
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
          />
        </View>
        <View className="flex-1">
          <AppInput
            label="Logged time"
            value={time}
            onChangeText={setTime}
            placeholder="HH:MM"
          />
        </View>
      </View>
      <AppInput
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Dinner at home"
      />
      <AppText variant="caption" muted>
        Trusted nutrition is resolved by the backend. AI estimates remain
        low-trust and unlinked; the mobile app sends only the opaque server
        proof and explicit edits.
      </AppText>
      {disposition.canContinue ? null : (
        <AppText variant="caption" className="text-error">
          Resolve every active row or exclude it before saving. At least one
          trusted or estimated row is required.
        </AppText>
      )}
    </AppScreen>
  );
}
