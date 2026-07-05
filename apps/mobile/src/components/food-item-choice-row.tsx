import { Pressable, View } from 'react-native';
import { Bookmark, BookmarkCheck } from 'lucide-react-native';
import type { FoodItem, TrackingMode } from '@food-tracker/shared';
import { AppText } from './app-text';
import { colors } from '@/theme/tokens';

function servingLabel(foodItem: FoodItem): string | null {
  if (foodItem.servingQuantity === null || foodItem.servingUnit === null) {
    return null;
  }

  return `${foodItem.servingQuantity} ${foodItem.servingUnit}`;
}

function nutrientText(foodItem: FoodItem, mode: TrackingMode): string {
  const parts = [
    foodItem.calories === null ? null : `${foodItem.calories} kcal`,
    foodItem.protein === null
      ? null
      : `${foodItem.protein.toFixed(1)}g protein`,
  ].filter((value): value is string => value !== null);

  if (mode === 'complex') {
    for (const [value, label] of [
      [foodItem.carbs, 'carbs'],
      [foodItem.fat, 'fat'],
      [foodItem.fiber, 'fiber'],
    ] as const) {
      if (value !== null) {
        parts.push(`${value.toFixed(1)}g ${label}`);
      }
    }
  }

  return parts.length === 0 ? 'Nutrition unknown' : parts.join(' · ');
}

export function FoodItemChoiceRow({
  foodItem,
  mode,
  selected = false,
  onPress,
  onToggleSave,
  saving = false,
}: {
  foodItem: FoodItem;
  mode: TrackingMode;
  selected?: boolean;
  onPress: () => void;
  onToggleSave?: () => void;
  saving?: boolean;
}) {
  const serving = servingLabel(foodItem);
  const saved = foodItem.isSaved;
  const Icon = saved ? BookmarkCheck : Bookmark;

  return (
    <Pressable
      accessibilityLabel={`Choose ${foodItem.name}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-3 py-3.5 active:bg-[#F6F6F6] ${
        selected ? 'bg-[#F4F4F4]' : ''
      }`}
      onPress={onPress}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4]">
        <AppText variant="label" className="text-ink">
          {foodItem.name.slice(0, 1).toUpperCase()}
        </AppText>
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <AppText variant="label" numberOfLines={1}>
          {foodItem.name}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {[foodItem.brandName, serving].filter(Boolean).join(' · ') ||
            'Reusable food'}
        </AppText>
        <AppText variant="caption" className="text-ink" numberOfLines={1}>
          {nutrientText(foodItem, mode)}
        </AppText>
      </View>
      {onToggleSave === undefined ? null : (
        <Pressable
          accessibilityLabel={
            saved ? `Unsave ${foodItem.name}` : `Save ${foodItem.name}`
          }
          accessibilityRole="button"
          className="min-h-10 min-w-10 items-center justify-center rounded-full active:bg-primary-soft"
          disabled={saving}
          onPress={(event) => {
            event.stopPropagation();
            onToggleSave();
          }}
        >
          <Icon
            color={saved ? colors.light.ink : colors.light.muted}
            size={18}
            strokeWidth={2.2}
          />
        </Pressable>
      )}
    </Pressable>
  );
}
