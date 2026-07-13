import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { ServingAmountControl } from '@/components/serving-amount-control';
import {
  availableServingChoices,
  changeServingChoice,
  nutritionBasisLabel,
} from '@/lib/serving-preview';
import { recipeServingBasis, recipeServingPreview } from '@/lib/recipe-ui';
import type { RecipeServingResult } from '@/lib/recipe-ui';
import { useAppStore } from '@/store/app-store';

export default function RecipeIngredientServingScreen() {
  const router = useRouter();
  const session = useAppStore((state) => state.recipeServingSession);
  const finish = useAppStore((state) => state.finishRecipeServing);
  const [draft, setDraft] = useState(session?.draft ?? null);
  const [saving, setSaving] = useState(false);
  const completed = useRef(false);

  useEffect(() => {
    setDraft(session?.draft ?? null);
  }, [session]);

  useEffect(
    () => () => {
      if (session !== null && !completed.current) {
        finish(session.key, { operation: session.operation, draft: null });
      }
    },
    [finish, session],
  );

  const basis = useMemo(
    () =>
      draft?.food === null || draft === null
        ? null
        : recipeServingBasis(draft.food),
    [draft],
  );
  const preview = draft === null ? null : recipeServingPreview(draft);
  const choices = basis === null ? [] : availableServingChoices(basis);
  const selectedChoiceId =
    draft === null
      ? null
      : draft.servingOptionId === null
        ? `unit:${draft.unit}`
        : `option:${draft.servingOptionId}`;

  if (session === null || draft === null || draft.food === null) {
    return (
      <AppScreen>
        <LoadingState message="Opening serving details…" />
      </AppScreen>
    );
  }

  if (basis === null) {
    return (
      <ErrorState
        title="Serving unavailable"
        message="This food has no usable serving basis."
      />
    );
  }

  const cancel = () => {
    const result: RecipeServingResult = {
      operation: session.operation,
      draft: null,
    };
    completed.current = true;
    finish(session.key, result);
    router.back();
  };

  const confirm = () => {
    if (
      preview === null ||
      preview.requestedServing === null ||
      (preview.status !== 'exact' && preview.status !== 'converted')
    ) {
      return;
    }
    setSaving(true);
    completed.current = true;
    finish(session.key, {
      operation: session.operation,
      draft: {
        ...draft,
        amount: String(preview.requestedServing.quantity),
        unit: preview.requestedServing.unit,
        servingOptionId: preview.requestedServing.servingOptionId,
        servingStatus: 'ready',
      },
    });
    router.back();
  };

  const disabled =
    saving ||
    preview === null ||
    preview.requestedServing === null ||
    (preview.status !== 'exact' && preview.status !== 'converted');

  return (
    <AppScreen contentClassName="gap-6 pb-8">
      <ScreenHeader
        eyebrow={
          session.context === 'mixedMeal'
            ? 'Mixed meal ingredient'
            : 'Recipe ingredient'
        }
        title={draft.food.name}
        subtitle={
          session.context === 'mixedMeal'
            ? 'Choose the amount used in this meal.'
            : 'Choose the amount used in this recipe.'
        }
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel serving details"
            className="rounded-full bg-surface px-3.5 py-2"
            onPress={cancel}
          >
            <AppText variant="label" className="text-primary-dark">
              Cancel
            </AppText>
          </Pressable>
        }
      />
      <View className="gap-1">
        <AppText variant="heading">
          {session.context === 'mixedMeal'
            ? 'How much is in this meal?'
            : 'How much is in this recipe?'}
        </AppText>
        <AppText variant="caption" muted>
          {nutritionBasisLabel(basis)}
        </AppText>
      </View>
      {preview?.status === 'needs_review' || preview?.status === 'invalid' ? (
        <ErrorState title="Serving needs attention" message={preview.message} />
      ) : null}
      {preview === null ? null : (
        <ServingAmountControl
          amount={draft.amount}
          basisLabel={nutritionBasisLabel(basis)}
          choices={choices}
          disabled={saving}
          onAmountChange={(amount) =>
            setDraft((current) =>
              current === null ? current : { ...current, amount },
            )
          }
          onReset={() =>
            setDraft((current) =>
              current === null
                ? current
                : {
                    ...current,
                    amount: String(basis.servingQuantity ?? ''),
                    unit: basis.servingUnit ?? '',
                    servingOptionId: null,
                  },
            )
          }
          onSelectChoice={(choice) =>
            setDraft((current) => {
              if (current === null) return current;
              const converted = changeServingChoice(
                {
                  amount: current.amount,
                  unit: current.unit,
                  servingOptionId: current.servingOptionId,
                },
                choice,
              );
              return converted.error === undefined
                ? {
                    ...current,
                    amount: converted.amount,
                    unit: converted.unit,
                    servingOptionId: converted.servingOptionId,
                  }
                : current;
            })
          }
          preview={preview}
          selectedChoiceId={selectedChoiceId}
        />
      )}
      <AppButton disabled={disabled} loading={saving} onPress={confirm}>
        {session.operation === 'add' ? 'Add ingredient' : 'Save changes'}
      </AppButton>
    </AppScreen>
  );
}
