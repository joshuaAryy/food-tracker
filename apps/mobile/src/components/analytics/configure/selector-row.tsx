import { Pressable, View } from 'react-native';
import { AppText } from '@/components/app-text';

export function SelectorRow({
  label,
  description,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      className={`min-h-[72px] flex-row items-center gap-4 rounded-[16px] border px-4 py-3 ${selected ? 'border-[#33B866] bg-[#F5FAF5]' : 'border-border bg-white'}`}
      onPress={onPress}
    >
      <View
        className={`h-[22px] w-[22px] items-center justify-center rounded-full border ${selected ? 'border-[#33B866]' : 'border-border'}`}
      >
        <View
          className={`h-2.5 w-2.5 rounded-[5px] ${selected ? 'bg-[#33B866]' : 'bg-transparent'}`}
        />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption" className="text-muted">
          {description}
        </AppText>
      </View>
    </Pressable>
  );
}
