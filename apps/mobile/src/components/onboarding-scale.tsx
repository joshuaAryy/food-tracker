import { Pressable, View } from 'react-native';
import { AppText } from './app-text';

const darkPrimaryText = '#F7F7F4';
const darkSecondaryText = '#C9CCC4';
const darkTertiaryText = '#A8ADA2';

interface ScaleOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

interface OnboardingScaleProps<T extends string> {
  options: readonly ScaleOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function OnboardingScale<T extends string>({
  options,
  value,
  onChange,
}: OnboardingScaleProps<T>) {
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  const selected = options[selectedIndex] ?? options[0];

  if (selected === undefined) {
    return null;
  }

  return (
    <View className="rounded-[30px] border border-onboarding-line bg-onboarding-surface p-5">
      <View className="min-h-[112px] justify-center rounded-[24px] bg-onboarding-text px-5 py-4">
        <AppText
          variant="caption"
          className="text-white"
          style={{ color: darkTertiaryText }}
        >
          SELECTED
        </AppText>
        <AppText
          variant="title"
          className="mt-1 text-white"
          style={{ color: darkPrimaryText }}
        >
          {selected.label}
        </AppText>
        <AppText
          className="mt-2 text-white leading-5"
          style={{ color: darkSecondaryText }}
        >
          {selected.description}
        </AppText>
      </View>
      <View className="relative mt-6 px-1 pb-2">
        <View className="absolute left-6 right-6 top-[23px] h-1 rounded-full bg-onboarding-line" />
        <View className="flex-row justify-between">
          {options.map((option, index) => {
            const optionSelected = option.value === value;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: optionSelected }}
                className="h-12 w-12 items-center justify-center"
                hitSlop={8}
                onPress={() => onChange(option.value)}
              >
                <View
                  className={`items-center justify-center rounded-full border ${
                    optionSelected
                      ? 'h-12 w-12 border-onboarding-text bg-onboarding-text'
                      : 'h-9 w-9 border-onboarding-line bg-onboarding-surface-muted'
                  }`}
                >
                  <AppText
                    variant="caption"
                    className={
                      optionSelected
                        ? 'text-white'
                        : 'text-onboarding-muted tabular-nums'
                    }
                    style={
                      optionSelected ? { color: darkPrimaryText } : undefined
                    }
                  >
                    {index + 1}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View className="mt-2 flex-row justify-between gap-3">
        <AppText variant="caption" className="text-onboarding-muted">
          {options[0]?.label}
        </AppText>
        <AppText
          variant="caption"
          className="flex-1 text-right text-onboarding-muted"
        >
          {options[options.length - 1]?.label}
        </AppText>
      </View>
    </View>
  );
}
