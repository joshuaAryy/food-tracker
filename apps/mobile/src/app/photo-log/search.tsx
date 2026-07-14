import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AiFoodParseCandidate, TrackingMode } from '@food-tracker/shared';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { FoodItemChoiceRow } from '@/components/food-item-choice-row';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { addPhotoRow, replacePhotoRowCandidate } from '@/lib/photo-log-ui';
import { useAppStore } from '@/store/app-store';

export default function PhotoLogSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ context?: string; rowId?: string }>();
  const context = params.context === 'replace' ? 'replace' : 'add';
  const rowId = typeof params.rowId === 'string' ? params.rowId : null;
  const session = useAppStore((state) => state.photoLogSession);
  const setRows = useAppStore((state) => state.setPhotoLogRows);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<AiFoodParseCandidate[]>([]);
  const [mode, setMode] = useState<TrackingMode>('simple');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.trackingPreferences
      .get()
      .then((preferences) => setMode(preferences.mode))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setCandidates([]);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      void api.foodItems
        .searchCandidates({ query: trimmed, limit: 8 })
        .then((next) => {
          if (active) setCandidates(next);
        })
        .catch((cause) => {
          if (active) setError(errorMessage(cause));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const selectCandidate = (candidate: AiFoodParseCandidate) => {
    if (session === null || (candidates.length === 0 && context === 'replace'))
      return;
    if (context === 'replace' && rowId !== null) {
      const row = session.rows.find((item) => item.id === rowId);
      if (row === undefined) return;
      setRows(
        session.rows.map((item) =>
          item.id === rowId ? replacePhotoRowCandidate(item, candidate) : item,
        ),
      );
    } else {
      if (session.rows.length >= 8) {
        setError('A photo can contain up to eight review rows.');
        return;
      }
      setRows([...session.rows, addPhotoRow(candidate, session.rows.length)]);
    }
    router.back();
  };

  if (session === null) return null;
  return (
    <AppScreen contentClassName="gap-5">
      <ScreenHeader
        eyebrow="Photo logging"
        title={
          context === 'replace' ? 'Replace trusted food' : 'Add missed food'
        }
        subtitle={
          context === 'replace'
            ? 'The recognized identity stays visible while you choose a trusted FoodItem.'
            : 'This food was added by you, not recognized by the photo provider.'
        }
        action={
          <Pressable onPress={() => router.back()}>
            <AppText variant="label">Cancel</AppText>
          </Pressable>
        }
      />
      <AppInput
        autoCapitalize="none"
        autoCorrect={false}
        label="Search trusted foods"
        placeholder="Chicken breast"
        value={query}
        onChangeText={setQuery}
      />
      {loading ? <LoadingState message="Searching trusted foods…" /> : null}
      {error === null ? null : (
        <ErrorState title="Food search unavailable" message={error} />
      )}
      {!loading && error === null && query.trim().length < 2 ? (
        <EmptyState
          title="Start with two letters"
          message="Search saved, recent, app, Open Food Facts, and USDA-backed foods."
        />
      ) : null}
      {!loading &&
      error === null &&
      query.trim().length >= 2 &&
      candidates.length === 0 ? (
        <EmptyState
          title="No trusted matches"
          message="Try another name. Photo analysis never creates a new FoodItem."
        />
      ) : null}
      <View className="border-y border-line">
        {candidates.map((candidate, index) => (
          <View
            key={`${candidate.candidateType}-${index}`}
            className={index === 0 ? '' : 'border-t border-line'}
          >
            {candidate.candidateType === 'food_item' ? (
              <FoodItemChoiceRow
                foodItem={candidate.foodItem}
                mode={mode}
                onPress={() => selectCandidate(candidate)}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                className="gap-1 px-4 py-3.5 active:bg-module-muted"
                onPress={() => selectCandidate(candidate)}
              >
                <AppText variant="label">{candidate.externalFood.name}</AppText>
                <AppText variant="caption" muted>
                  USDA · {candidate.externalFood.servingBasisText}
                </AppText>
                <AppText variant="caption">
                  {candidate.externalFood.calories === null
                    ? 'Calories unknown'
                    : `${candidate.externalFood.calories} kcal`}{' '}
                  ·{' '}
                  {candidate.externalFood.protein === null
                    ? 'Protein unknown'
                    : `${candidate.externalFood.protein} g protein`}
                </AppText>
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </AppScreen>
  );
}
