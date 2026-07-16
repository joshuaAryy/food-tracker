import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
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
import {
  addPhotoRow,
  materializePhotoCandidate,
  replacePhotoRowCandidate,
} from '@/lib/photo-log-ui';
import { externalCandidatePersistenceInput } from '@/lib/recipe-ui';
import { safePhotoLogBack } from '@/lib/photo-log-navigation';
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
  const [resolvingCandidate, setResolvingCandidate] = useState<string | null>(
    null,
  );
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

  const selectCandidate = async (candidate: AiFoodParseCandidate) => {
    if (
      session === null ||
      (candidates.length === 0 && context === 'replace') ||
      resolvingCandidate !== null
    )
      return;
    let resolvedCandidate = candidate;
    if (candidate.candidateType === 'external_food') {
      const input = externalCandidatePersistenceInput(candidate);
      if (input === null) {
        setError(
          'This external candidate cannot be resolved for trusted logging.',
        );
        return;
      }
      const key = `${input.sourceProvider}:${input.sourceId}`;
      setResolvingCandidate(key);
      setError(null);
      try {
        resolvedCandidate = materializePhotoCandidate(
          candidate,
          await api.foodItems.persistExternalCandidate(input),
        );
      } catch (cause) {
        setError(
          errorMessage(
            cause,
            'This external candidate could not be resolved. Choose another match, use the estimate, or exclude the row.',
          ),
        );
        setResolvingCandidate(null);
        return;
      }
      setResolvingCandidate(null);
    }
    if (context === 'replace' && rowId !== null) {
      const row = session.rows.find((item) => item.id === rowId);
      if (row === undefined) return;
      setRows(
        session.rows.map((item) =>
          item.id === rowId
            ? replacePhotoRowCandidate(item, resolvedCandidate)
            : item,
        ),
      );
    } else {
      if (session.rows.length >= 8) {
        setError('A photo can contain up to eight review rows.');
        return;
      }
      setRows([
        ...session.rows,
        addPhotoRow(resolvedCandidate, session.rows.length),
      ]);
    }
    safePhotoLogBack({
      canGoBack: router.canGoBack,
      back: router.back,
      replace: router.replace,
      fallback: '/photo-log/review' as Href,
    });
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
          <Pressable
            disabled={resolvingCandidate !== null}
            onPress={() =>
              safePhotoLogBack({
                canGoBack: router.canGoBack,
                back: router.back,
                replace: router.replace,
                fallback: '/photo-log/review' as Href,
              })
            }
          >
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
      {resolvingCandidate !== null ? (
        <LoadingState message="Resolving the selected provider food…" />
      ) : null}
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
                onPress={() => void selectCandidate(candidate)}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                className="gap-1 px-4 py-3.5 active:bg-module-muted"
                onPress={() => void selectCandidate(candidate)}
              >
                <AppText variant="label">{candidate.externalFood.name}</AppText>
                <AppText variant="caption" muted>
                  Database match · {candidate.externalFood.servingBasisText}
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
