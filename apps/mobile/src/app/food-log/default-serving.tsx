import { useEffect, useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { ServingAmountControl } from '@/components/serving-amount-control';
import { api, errorMessage } from '@/lib/api-client';
import { defaultServingDraft } from '@/lib/food-library-ui';
import {
  availableServingChoices,
  changeServingChoice,
  nutritionBasisLabel,
  provisionalServingPreview,
} from '@/lib/serving-preview';
import { recipeServingBasis } from '@/lib/recipe-ui';
import { useAppStore } from '@/store/app-store';
import type { FoodItem } from '@food-tracker/shared';

export default function DefaultServingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [food, setFood] = useState<FoodItem | null>(null);
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');
  const [optionId, setOptionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void api.foodItems
      .getById(id)
      .then((item) => {
        setFood(item);
        const draft = defaultServingDraft(item);
        setAmount(draft.amount);
        setUnit(draft.unit);
        setOptionId(draft.servingOptionId);
      })
      .catch((cause) => setError(errorMessage(cause)));
  }, [id]);
  const basis = useMemo(
    () => (food === null ? null : recipeServingBasis(food)),
    [food],
  );
  const preview =
    basis === null
      ? null
      : provisionalServingPreview({
          basis,
          request: { quantityText: amount, unit, servingOptionId: optionId },
        });
  if (food === null || basis === null)
    return (
      <AppScreen>
        {error ? (
          <ErrorState title="Serving unavailable" message={error} />
        ) : (
          <LoadingState message="Loading serving…" />
        )}
      </AppScreen>
    );
  if (preview === null)
    return (
      <AppScreen>
        <ErrorState
          title="Serving unavailable"
          message="This food has no usable serving basis."
        />
      </AppScreen>
    );
  const valid =
    preview.requestedServing !== null &&
    (preview.status === 'exact' || preview.status === 'converted');
  return (
    <AppScreen
      contentClassName="gap-5"
      footer={
        <AppButton
          disabled={!valid || saving}
          loading={saving}
          onPress={() =>
            void (async () => {
              if (!preview.requestedServing) return;
              setSaving(true);
              try {
                await api.foodItems.setDefaultServing(food.id, {
                  quantity: preview.requestedServing.quantity,
                  unit: preview.requestedServing.unit,
                  servingOptionId: preview.requestedServing.servingOptionId,
                });
                markDataChanged();
                router.back();
              } catch (cause) {
                setError(errorMessage(cause));
                setSaving(false);
              }
            })()
          }
        >
          Save default serving
        </AppButton>
      }
    >
      <ScreenHeader
        eyebrow="Food Library"
        title="Default serving"
        subtitle={`Use this as the starting amount for ${food.name}.`}
        action={
          <Pressable onPress={() => router.back()}>
            <AppText variant="label">Cancel</AppText>
          </Pressable>
        }
      />
      {error ? (
        <ErrorState title="Serving needs attention" message={error} />
      ) : null}
      <ServingAmountControl
        amount={amount}
        basisLabel={nutritionBasisLabel(basis)}
        choices={availableServingChoices(basis)}
        disabled={saving}
        onAmountChange={setAmount}
        onReset={() => {
          const draft = defaultServingDraft(food);
          setAmount(draft.amount);
          setUnit(draft.unit);
          setOptionId(draft.servingOptionId);
        }}
        onSelectChoice={(choice) => {
          const next = changeServingChoice(
            { amount, unit, servingOptionId: optionId },
            choice,
          );
          if (next.error === undefined) {
            setAmount(next.amount);
            setUnit(next.unit);
            setOptionId(next.servingOptionId);
          }
        }}
        preview={preview}
        selectedChoiceId={
          optionId === null ? `unit:${unit}` : `option:${optionId}`
        }
      />
    </AppScreen>
  );
}
