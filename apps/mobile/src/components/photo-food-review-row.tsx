import { Pressable, View } from 'react-native';
import type { AiFoodParseCandidate, TrackingMode } from '@food-tracker/shared';
import { AppButton } from './app-button';
import { AppText } from './app-text';
import { EstimatedFoodReviewEditor } from './estimated-food-review-editor';
import { ServingAmountControl } from './serving-amount-control';
import {
  photoCandidateId,
  photoCandidateIsMixedCompatible,
  photoCandidateName,
  photoCandidateSourceLabel,
  photoNutritionProjection,
  photoRowDisplayName,
  photoRowReason,
  photoRowStatusLabel,
  photoRowServingChoices,
  photoRowServingPreview,
  changePhotoServingChoice,
  type PhotoExternalResolutionState,
  selectedPhotoCandidate,
  setPhotoRowDisposition,
  type PhotoReviewRow,
} from '@/lib/photo-log-ui';

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
  onResolveExternal,
  externalResolutionState = 'none',
  externalResolutionError,
}: {
  row: PhotoReviewRow;
  mode: TrackingMode;
  error?: string | undefined;
  onChange: (next: PhotoReviewRow) => void;
  onReplace: () => void;
  onToggleInclude: () => void;
  onResolveExternal?: (() => void) | undefined;
  externalResolutionState?: PhotoExternalResolutionState | undefined;
  externalResolutionError?: string | undefined;
}) {
  const candidate = selectedPhotoCandidate(row);
  const preview = photoRowServingPreview(row);
  const nutrition = photoNutritionProjection(row, mode);
  const choices = photoRowServingChoices(row);
  const included = row.disposition !== 'excluded';
  const rowError = error ?? photoRowReason(row);
  const detectedQuantity =
    row.recognizedItem.provisionalPortion?.quantity.state === 'estimated'
      ? row.recognizedItem.provisionalPortion.quantity.rawText
      : null;
  const normalizedByPhotoEstimate =
    row.recognizedItem.provisionalPortion?.resolvedServing
      ?.normalizationMethod === 'ai_photo_mass_estimate';

  if (row.disposition === 'excluded') {
    const name = photoRowDisplayName(row);
    return (
      <View className="gap-3 rounded-[26px] bg-module px-4 py-4 opacity-70">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="heading" accessibilityLabel={name}>
              {name}
            </AppText>
            <AppText variant="caption" muted>
              Excluded
            </AppText>
          </View>
          <Pressable
            accessibilityLabel={`Restore ${name}`}
            accessibilityRole="button"
            className="rounded-full bg-surface-raised px-3 py-2"
            onPress={onToggleInclude}
          >
            <AppText variant="label">Restore</AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (row.disposition === 'estimated') {
    const name = photoRowDisplayName(row);
    return (
      <View className="gap-3 rounded-[26px] bg-module px-4 py-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="heading" accessibilityLabel={name}>
              {name}
            </AppText>
            <AppText variant="caption" muted>
              Recognized from photo · {row.recognizedItem.identityConfidence}{' '}
              identity confidence
            </AppText>
          </View>
          <Pressable
            accessibilityLabel={`Exclude ${name}`}
            accessibilityRole="button"
            className="rounded-full bg-surface-raised px-3 py-2"
            onPress={onToggleInclude}
          >
            <AppText variant="label">Exclude</AppText>
          </Pressable>
        </View>
        <EstimatedFoodReviewEditor
          row={row}
          onChange={onChange}
          onReplace={
            row.recognizedItem.candidates.length > 0 ? onReplace : undefined
          }
          onUseExternal={
            externalResolutionState === 'available' ||
            externalResolutionState === 'failed' ||
            externalResolutionState === 'materializing'
              ? onResolveExternal
              : undefined
          }
          externalResolving={externalResolutionState === 'materializing'}
          onExclude={onToggleInclude}
        />
        {rowError === null ? null : (
          <AppText variant="caption" className="text-error">
            {rowError}
          </AppText>
        )}
      </View>
    );
  }

  if (
    row.disposition === 'unresolved' ||
    !photoCandidateIsMixedCompatible(candidate)
  ) {
    return (
      <View className="gap-3 rounded-[26px] bg-module px-4 py-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <AppText
              variant="heading"
              accessibilityLabel={photoRowDisplayName(row)}
            >
              {photoRowDisplayName(row)}
            </AppText>
            <AppText variant="caption" muted>
              {photoRowStatusLabel(row)}
            </AppText>
          </View>
          <Pressable
            accessibilityLabel={`Exclude ${row.recognizedItem.recognizedName}`}
            accessibilityRole="button"
            className="rounded-full bg-surface-raised px-3 py-2"
            onPress={onToggleInclude}
          >
            <AppText variant="label">Exclude</AppText>
          </Pressable>
        </View>
        <View className="gap-2 rounded-control bg-error-soft px-3 py-3">
          <AppText variant="label" className="text-error">
            Unresolved row
          </AppText>
          <AppText variant="caption" className="text-error">
            {externalResolutionError ??
              rowError ??
              'Choose a compatible trusted food, use the estimate, or exclude this row.'}
          </AppText>
          {(externalResolutionState === 'available' ||
            externalResolutionState === 'failed' ||
            externalResolutionState === 'materializing') &&
          onResolveExternal !== undefined ? (
            <AppButton
              disabled={externalResolutionState === 'materializing'}
              onPress={onResolveExternal}
            >
              {externalResolutionState === 'materializing'
                ? 'Resolving match…'
                : 'Use this match'}
            </AppButton>
          ) : null}
          {row.recognizedItem.candidates.length > 0 ? (
            <AppButton variant="secondary" onPress={onReplace}>
              Choose a trusted food
            </AppButton>
          ) : null}
          {row.recognizedItem.estimatedNutrition?.estimateProof &&
          row.estimateProofUnavailable !== true ? (
            <AppButton
              variant="secondary"
              onPress={() => onChange(setPhotoRowDisposition(row, 'estimated'))}
            >
              Use AI estimate
            </AppButton>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View className="gap-3 rounded-[26px] bg-module px-4 py-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <AppText
              variant="heading"
              accessibilityLabel={photoRowDisplayName(row)}
            >
              {photoRowDisplayName(row)}
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
              : `Restore ${row.recognizedItem.recognizedName}`
          }
          accessibilityRole="button"
          className="rounded-full bg-surface-raised px-3 py-2"
          onPress={onToggleInclude}
        >
          <AppText variant="label">{included ? 'Exclude' : 'Restore'}</AppText>
        </Pressable>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <AppText variant="caption" muted>
              Trusted match · {photoCandidateSourceLabel(candidate)}
            </AppText>
            <AppText
              variant="label"
              accessibilityLabel={`Trusted match: ${photoCandidateName(candidate)}`}
            >
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
            basisLabel={
              normalizedByPhotoEstimate
                ? 'Amount estimated from photo — please review.'
                : row.recognizedItem.provisionalPortion?.resolvedServing
                      ?.reviewRequired === true
                  ? 'Choose a compatible serving for this trusted match.'
                  : 'Serving matched to the amount detected in the photo.'
            }
            choices={choices}
            compact
            disabled={!included}
            placeholder="Choose amount"
            onAmountChange={(amount) =>
              onChange({
                ...row,
                amount,
                servingReviewed: false,
                status: 'pending',
              })
            }
            onReset={() => {
              const food = candidate.foodItem;
              onChange({
                ...row,
                amount:
                  food.servingQuantity === null
                    ? ''
                    : String(food.servingQuantity),
                unit: food.servingUnit ?? '',
                servingOptionId: null,
                servingReviewed: false,
                status: 'pending',
              });
            }}
            onSelectChoice={(choice) => {
              const next = changePhotoServingChoice(row, choice);
              if (next.error === undefined) {
                onChange({
                  ...row,
                  amount: next.amount,
                  unit: next.unit,
                  servingOptionId: next.servingOptionId,
                  servingReviewed: false,
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
        {detectedQuantity === null ? null : (
          <AppText variant="caption" muted>
            Detected: {detectedQuantity}
          </AppText>
        )}
      </View>

      <View className="gap-2">
        <AppText variant="caption" muted>
          {rowError !== null
            ? row.amount.trim() === ''
              ? 'Enter an amount to continue'
              : 'Adjust amount'
            : 'Trusted match'}
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
            {nutrition.fat === null ? 'Fat unknown' : `${nutrition.fat} g fat`}
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
        {rowError === null ? (
          <AppText variant="label" className="text-sage-dark">
            Trusted and included
          </AppText>
        ) : null}
        {row.recognizedItem.estimatedNutrition?.estimateProof &&
        row.estimateProofUnavailable !== true ? (
          <AppButton
            variant="secondary"
            onPress={() => onChange(setPhotoRowDisposition(row, 'estimated'))}
          >
            Use AI estimate instead
          </AppButton>
        ) : null}
      </View>
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
