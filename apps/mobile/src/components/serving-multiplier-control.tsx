import { Pressable, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { AppInput } from './app-input';
import { AppText } from './app-text';

function clampMultiplier(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0.25, Math.round(value * 4) / 4);
}

export function ServingMultiplierControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const numericValue = Number(value);
  const adjust = (delta: number) => {
    onChange(
      String(
        clampMultiplier(
          (Number.isFinite(numericValue) ? numericValue : 1) + delta,
        ),
      ),
    );
  };

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <View>
          <AppText variant="label">Amount</AppText>
          <AppText variant="caption" muted>
            How many listed servings
          </AppText>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityLabel="Decrease amount"
            accessibilityRole="button"
            className="h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] active:bg-primary-soft"
            onPress={() => adjust(-0.25)}
          >
            <Minus color="#111111" size={17} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            accessibilityLabel="Increase amount"
            accessibilityRole="button"
            className="h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] active:bg-primary-soft"
            onPress={() => adjust(0.25)}
          >
            <Plus color="#111111" size={17} strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>
      <AppInput
        label="Servings"
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}
