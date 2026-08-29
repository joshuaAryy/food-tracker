import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';

interface TargetRow {
  nutrientKey: string;
  unit: string;
  direction: string;
  effectiveValue: number | null;
  recommendedValue: number | null;
  effectiveSource: string;
  isCustom: boolean;
}

export default function NutritionTargetsScreen() {
  const router = useRouter();
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await api.nutritionTargets.list();
      const next = response.targets as unknown as TargetRow[];
      setTargets(next);
      setDrafts(
        Object.fromEntries(
          next.map((target) => [
            target.nutrientKey,
            target.effectiveValue === null ? '' : String(target.effectiveValue),
          ]),
        ),
      );
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (target: TargetRow) => {
    const value = Number(drafts[target.nutrientKey]);
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      (target.direction !== 'limit' && value === 0)
    )
      return;
    setSaving(target.nutrientKey);
    try {
      const response = await api.nutritionTargets.set(
        target.nutrientKey,
        value,
      );
      setTargets(response.targets as unknown as TargetRow[]);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(null);
    }
  };

  const useRecommended = async (target: TargetRow) => {
    setSaving(target.nutrientKey);
    try {
      const response = await api.nutritionTargets.useRecommended(
        target.nutrientKey,
      );
      setTargets(response.targets as unknown as TargetRow[]);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(null);
    }
  };

  if (loading)
    return (
      <AppScreen>
        <AppText variant="heading">Loading nutrition targets…</AppText>
      </AppScreen>
    );
  if (error !== null && targets.length === 0)
    return (
      <AppScreen>
        <ErrorState
          title="Couldn’t load targets"
          message={error}
          onRetry={() => void load()}
        />
      </AppScreen>
    );

  return (
    <AppScreen contentClassName="gap-5">
      <ScreenHeader
        title="Nutrition targets"
        action={
          <Pressable onPress={() => router.back()}>
            <AppText variant="label">Back</AppText>
          </Pressable>
        }
      />
      <AppText muted>
        Recommended values update with your profile and current weight. Custom
        values stay in place until you choose Use recommended.
      </AppText>
      {error === null ? null : (
        <ErrorState title="Couldn’t save target" message={error} />
      )}
      {targets.map((target) => (
        <View
          key={target.nutrientKey}
          className="gap-2 rounded-2xl border border-line bg-surface p-4"
        >
          <View className="flex-row items-center justify-between">
            <AppText variant="label">{target.nutrientKey}</AppText>
            <AppText variant="caption" muted>
              {target.isCustom ? 'Custom' : target.effectiveSource}
            </AppText>
          </View>
          <AppInput
            label={`${target.direction} (${target.unit})`}
            keyboardType="decimal-pad"
            value={drafts[target.nutrientKey] ?? ''}
            onChangeText={(value) =>
              setDrafts((current) => ({
                ...current,
                [target.nutrientKey]: value,
              }))
            }
          />
          <AppText variant="caption" muted>
            {target.recommendedValue === null
              ? 'No automatic reference is available.'
              : `Recommended: ${target.recommendedValue} ${target.unit}`}
          </AppText>
          <View className="flex-row gap-2">
            <AppButton
              className="flex-1"
              loading={saving === target.nutrientKey}
              onPress={() => void save(target)}
            >
              Save custom
            </AppButton>
            {target.isCustom ? (
              <Pressable
                className="flex-1 items-center justify-center rounded-full bg-primary-soft px-3"
                onPress={() => void useRecommended(target)}
              >
                <AppText variant="label">Use recommended</AppText>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </AppScreen>
  );
}
