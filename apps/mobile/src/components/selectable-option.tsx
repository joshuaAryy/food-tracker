import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from './app-text';

type SelectableOptionShape = 'card' | 'pill';

interface SelectableOptionProps<T extends string> {
  value: T;
  selected: boolean;
  label: string;
  description?: string | undefined;
  shape?: SelectableOptionShape;
  leading?: ReactNode;
  onSelect: (value: T) => void;
}

const shapeClasses: Record<SelectableOptionShape, string> = {
  card: 'rounded-control px-4 py-3',
  pill: 'min-h-10 rounded-full px-3.5 py-2',
};

export function SelectableOption<T extends string>({
  value,
  selected,
  label,
  description,
  shape = 'card',
  leading,
  onSelect,
}: SelectableOptionProps<T>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`border ${
        selected
          ? 'border-sage bg-sage-soft'
          : 'border-border bg-surface-raised'
      } ${shapeClasses[shape]} active:bg-sage-soft/70`}
      onPress={() => onSelect(value)}
    >
      <View className="flex-row items-center gap-2">
        {leading}
        <AppText
          variant="label"
          className={selected ? 'text-sage-dark' : 'text-ink'}
        >
          {label}
        </AppText>
      </View>
      {description === undefined ? null : (
        <AppText variant="caption" muted className="mt-1">
          {description}
        </AppText>
      )}
    </Pressable>
  );
}
