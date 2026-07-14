import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
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
import { errorMessage, api } from '@/lib/api-client';
import {
  photoCandidateName,
  photoRowServingPreview,
  photoRowsDisposition,
  photoRowsSaveRequest,
} from '@/lib/photo-log-ui';
import { dateTimeFieldsInTimezone, zonedDateTimeToIso } from '@/lib/date-time';
import { useAppStore } from '@/store/app-store';

export default function PhotoLogConfirmScreen() {
  const router = useRouter();
  const session = useAppStore((state) => state.photoLogSession);
  const clearSession = useAppStore((state) => state.clearPhotoLogSession);
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
    try {
      const request = photoRowsSaveRequest({
        rows: session.rows,
        mealType,
        loggedAt,
        notes: notes.trim() === '' ? null : notes.trim(),
      });
      await api.foodLogs.createFromCandidates(request);
      await cleanupPhotoFiles([
        { uri: session.normalizedUri, ownership: 'app_normalized' },
        { uri: session.originalUri, ownership: session.originalOwnership },
      ]);
      clearSession();
      markDataChanged();
      router.dismissAll();
    } catch (cause) {
      setError(
        errorMessage(
          cause,
          'Nothing was saved. Check the reviewed foods and try again.',
        ),
      );
      singleFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <AppScreen
      contentClassName="gap-5"
      footer={
        <AppButton
          loading={saving}
          disabled={saving || !disposition.canContinue || loggedAt === null}
          onPress={() => void save()}
        >
          Save reviewed foods
        </AppButton>
      }
    >
      <ScreenHeader
        eyebrow="Photo logging"
        title="Confirm food log"
        subtitle="Only the rows you included and confirmed will be sent to the authoritative save endpoint."
        action={
          <Pressable disabled={saving} onPress={() => router.back()}>
            <AppText variant="label">Back</AppText>
          </Pressable>
        }
      />
      {error === null ? null : (
        <ErrorState
          title="Save failed"
          message={error}
          onRetry={() => void save()}
        />
      )}
      <View className="gap-2 rounded-[26px] bg-module px-4 py-4">
        <AppText variant="label">Included foods</AppText>
        {disposition.included.map((row) => {
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
                        (candidate.candidateType === 'food_item'
                          ? candidate.foodItem.id
                          : `${candidate.externalFood.sourceProvider}:${candidate.externalFood.sourceId}`) ===
                        row.selectedCandidateId,
                    ) ?? null,
                  )}
                </AppText>
                <AppText variant="caption" muted>
                  {row.amount} {row.unit} ·{' '}
                  {row.addedByUser ? 'Added by you' : 'Photo match'}
                </AppText>
              </View>
              <AppText variant="caption" muted>
                {preview?.nutrition?.calories === null ||
                preview?.nutrition?.calories === undefined
                  ? 'Calories unknown'
                  : `${preview.nutrition.calories} kcal`}
              </AppText>
            </View>
          );
        })}
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
        Nutrition is resolved by the backend from the selected trusted foods and
        servings. This request contains no photo, provider output, or
        client-calculated nutrients.
      </AppText>
    </AppScreen>
  );
}
