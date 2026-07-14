import { Pressable, View } from 'react-native';
import type { AiFoodParseCandidate, TrackingMode } from '@food-tracker/shared';
import { AppButton } from './app-button';
import { AppText } from './app-text';
import { ServingAmountControl } from './serving-amount-control';
import {
  photoCandidateId,
  photoCandidateName,
  photoCandidateSourceLabel,
  photoNutritionProjection,
  photoRowReason,
  photoRowServingChoices,
  photoRowServingPreview,
  selectedPhotoCandidate,
  type PhotoReviewRow,
} from '@/lib/photo-log-ui';
import { changeServingChoice } from '@/lib/serving-preview';

function confidenceLabel(value: string | null): string {
  return value === null ? 'Not estimated' : `${value} confidence`;
}

export function PhotoFoodReviewRow({
  row,
  mode,
  error,
  onChange,
  onReplace,
  onToggleInclude,
  onConfirm,
}: {
  row: PhotoReviewRow;
  mode: TrackingMode;
  error?: string | undefined;
  onChange: (next: PhotoReviewRow) => void;
  onReplace: () => void;
  onToggleInclude: () => void;
  onConfirm: () => void;
}) {
  const candidate = selectedPhotoCandidate(row);
  const preview = photoRowServingPreview(row);
  const nutrition = photoNutritionProjection(row, mode);
  const choices = photoRowServingChoices(row);
  const included = row.status !== 'excluded';
  const rowError = error ?? photoRowReason(row);

  return (
    <View className="gap-3 rounded-[26px] bg-module px-4 py-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <AppText variant="heading" numberOfLines={1}>
              {row.recognizedItem.recognizedName}
            </AppText>
            {row.addedByUser ? (
              <View className="rounded-full bg-primary-soft px-2.5 py-1">
                <AppText variant="caption">Added by you</AppText>
              </View>
            ) : null}
          </View>
          {row.recognizedItem.preparationForm === null ? null : (
            <AppText variant="caption" muted>
              {row.recognizedItem.preparationForm}
            </AppText>
          )}
          <AppText variant="caption" muted>
            Identity {confidenceLabel(row.recognizedItem.identityConfidence)} ·
            Portion {confidenceLabel(row.recognizedItem.portionConfidence)}
          </AppText>
        </View>
        <Pressable
          accessibilityLabel={
            included
              ? `Exclude ${row.recognizedItem.recognizedName}`
              : `Include ${row.recognizedItem.recognizedName}`
          }
          accessibilityRole="button"
          className="rounded-full bg-surface-raised px-3 py-2"
          onPress={onToggleInclude}
        >
          <AppText variant="label">{included ? 'Exclude' : 'Include'}</AppText>
        </Pressable>
      </View>

      {candidate === null ? (
        <View className="gap-2 rounded-control bg-error-soft px-3 py-3">
          <AppText variant="label" className="text-error">
            No trusted food selected
          </AppText>
          <AppText variant="caption" className="text-error">
            Choose a trusted match before including this row.
          </AppText>
          <AppButton variant="secondary" onPress={onReplace}>
            Choose trusted food
          </AppButton>
        </View>
      ) : (
        <View className="gap-2">
          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1">
              <AppText variant="caption" muted>
                Trusted match · {photoCandidateSourceLabel(candidate)}
              </AppText>
              <AppText variant="label" numberOfLines={1}>
                {photoCandidateName(candidate)}
              </AppText>
            </View>
            <Pressable
              accessibilityLabel={`Replace trusted food for ${row.recognizedItem.recognizedName}`}
              accessibilityRole="button"
              className="rounded-full bg-surface-raised px-3 py-2"
              onPress={onReplace}
            >
              <AppText variant="label">Replace</AppText>
            </Pressable>
          </View>

          {choices.length === 0 || preview === null ? null : (
            <ServingAmountControl
              amount={row.amount}
              basisLabel="Serving uses the trusted food basis."
              choices={choices}
              compact
              disabled={!included}
              onAmountChange={(amount) =>
                onChange({ ...row, amount, status: 'pending' })
              }
              onReset={() => {
                const food =
                  candidate.candidateType === 'food_item'
                    ? candidate.foodItem
                    : candidate.externalFood;
                onChange({
                  ...row,
                  amount:
                    food.servingQuantity === null
                      ? ''
                      : String(food.servingQuantity),
                  unit: food.servingUnit ?? '',
                  servingOptionId: null,
                  status: 'pending',
                });
              }}
              onSelectChoice={(choice) => {
                const next = changeServingChoice(
                  {
                    amount: row.amount,
                    unit: row.unit,
                    servingOptionId: row.servingOptionId,
                  },
                  choice,
                );
                if (next.error === undefined) {
                  onChange({
                    ...row,
                    amount: next.amount,
                    unit: next.unit,
                    servingOptionId: next.servingOptionId,
                    status: 'pending',
                  });
                }
              }}
              preview={preview}
              selectedChoiceId={
                row.servingOptionId === null
                  ? `unit:${row.unit}`
                  : `option:${row.servingOptionId}`
              }
            />
          )}
        </View>
      )}

      {candidate === null ? null : (
        <View className="gap-2">
          <AppText variant="caption" muted>
            {row.candidateReviewed
              ? 'Match reviewed'
              : 'Match needs your review'}
            {row.recognizedItem.candidates.length > 1
              ? ' · Alternatives available'
              : ''}
          </AppText>
          {mode === 'complex' && nutrition !== null ? (
            <AppText variant="caption" className="text-muted">
              {nutrition.carbs === null
                ? 'Carbs unknown'
                : `${nutrition.carbs} g carbs`}{' '}
              ·{' '}
              {nutrition.fat === null
                ? 'Fat unknown'
                : `${nutrition.fat} g fat`}
              {Object.keys(nutrition.nutrients).length > 0
                ? ` · ${Object.keys(nutrition.nutrients).length} normalized nutrients`
                : ''}
            </AppText>
          ) : null}
          {rowError !== null && row.status !== 'excluded' ? (
            <AppText variant="caption" className="text-error">
              {rowError}
            </AppText>
          ) : null}
          {included && row.status !== 'confirmed' ? (
            <AppButton disabled={rowError !== null} onPress={onConfirm}>
              Confirm this row
            </AppButton>
          ) : row.status === 'confirmed' ? (
            <AppText variant="label" className="text-sage-dark">
              Included and confirmed
            </AppText>
          ) : null}
        </View>
      )}
    </View>
  );
}

export function candidateOptionsForPhotoRow(
  row: PhotoReviewRow,
): AiFoodParseCandidate[] {
  return row.recognizedItem.candidates.filter(
    (candidate) => photoCandidateId(candidate) !== row.selectedCandidateId,
  );
}
