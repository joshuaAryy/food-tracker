import { View } from 'react-native';
import { AppButton } from './app-button';
import { AppInput } from './app-input';
import { AppText } from './app-text';
import {
  photoEstimateValidation,
  updatePhotoEstimateDraft,
  type PhotoReviewRow,
} from '@/lib/photo-log-ui';

export function EstimatedFoodReviewEditor({
  row,
  onChange,
  onReplace,
  onUseExternal,
  externalResolving = false,
  onExclude,
}: {
  row: PhotoReviewRow;
  onChange: (next: PhotoReviewRow) => void;
  onReplace: (() => void) | undefined;
  onUseExternal?: (() => void) | undefined;
  externalResolving?: boolean | undefined;
  onExclude: () => void;
}) {
  const draft = row.estimateDraft;
  const estimate = row.recognizedItem.estimatedNutrition;
  if (draft === undefined || estimate === undefined) return null;
  const errors = photoEstimateValidation(row);
  const field = (key: keyof typeof draft, value: string) =>
    onChange(updatePhotoEstimateDraft(row, key, value));

  return (
    <View className="gap-3 rounded-control bg-primary-soft px-3 py-3">
      <View className="gap-1">
        <View className="flex-row items-center justify-between gap-2">
          <AppText variant="label">AI estimate</AppText>
          <AppText variant="caption" className="text-primary-dark">
            Low trust · {estimate.confidence} confidence
          </AppText>
        </View>
        <AppText variant="caption" muted>
          {estimate.label}
        </AppText>
      </View>
      <AppInput
        accessibilityLabel="Estimated food name"
        label="Food name"
        value={draft.foodName}
        error={errors.foodName}
        onChangeText={(value) => field('foodName', value)}
        autoCapitalize="sentences"
      />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <AppInput
            accessibilityLabel="Estimated calories"
            label="Calories"
            value={draft.calories}
            error={errors.calories}
            onChangeText={(value) => field('calories', value)}
            keyboardType="decimal-pad"
          />
        </View>
        <View className="flex-1">
          <AppInput
            accessibilityLabel="Estimated protein"
            label="Protein (g)"
            value={draft.proteinGrams}
            error={errors.proteinGrams}
            onChangeText={(value) => field('proteinGrams', value)}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <AppInput
            accessibilityLabel="Estimated carbohydrates"
            label="Carbs (g)"
            value={draft.carbohydrateGrams}
            error={errors.carbohydrateGrams}
            onChangeText={(value) => field('carbohydrateGrams', value)}
            keyboardType="decimal-pad"
          />
        </View>
        <View className="flex-1">
          <AppInput
            accessibilityLabel="Estimated fat"
            label="Fat (g)"
            value={draft.fatGrams}
            error={errors.fatGrams}
            onChangeText={(value) => field('fatGrams', value)}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {onUseExternal === undefined ? null : (
          <AppButton
            disabled={externalResolving}
            accessibilityLabel={`Use external trusted match for ${draft.foodName}`}
            onPress={onUseExternal}
          >
            {externalResolving ? 'Resolving match…' : 'Use this match'}
          </AppButton>
        )}
        {onReplace === undefined ? null : (
          <AppButton
            variant="secondary"
            accessibilityLabel={`Replace ${draft.foodName} with a trusted match`}
            onPress={onReplace}
          >
            Replace with trusted match
          </AppButton>
        )}
        <AppButton
          variant="danger"
          accessibilityLabel={`Exclude ${draft.foodName}`}
          onPress={onExclude}
        >
          Exclude
        </AppButton>
      </View>
    </View>
  );
}
