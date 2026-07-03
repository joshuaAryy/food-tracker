import { Pressable, View } from 'react-native';
import { AppText } from './app-text';

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
    <View className="gap-7">
      <View className="min-h-[116px] justify-center rounded-[34px] bg-onboarding-surface px-6 py-5">
        <AppText
          variant="caption"
          className="text-onboarding-muted uppercase tracking-[1.5px]"
        >
          Selected
        </AppText>
        <AppText variant="title" className="mt-1 text-onboarding-text">
          {selected.label}
        </AppText>
        <AppText className="mt-2 text-onboarding-muted leading-5">
          {selected.description}
        </AppText>
      </View>
      <View className="relative px-1 pb-2">
        <View className="absolute left-6 right-6 top-[23px] h-1.5 rounded-full bg-onboarding-line" />
        <View
          className="absolute left-6 top-[23px] h-1.5 rounded-full bg-onboarding-text"
          style={{
            width:
              options.length <= 1
                ? 0
                : `${(selectedIndex / (options.length - 1)) * 100}%`,
          }}
        />
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
                  className={`items-center justify-center rounded-full ${
                    optionSelected
                      ? 'h-12 w-12 bg-onboarding-text'
                      : 'h-9 w-9 bg-onboarding-surface'
                  }`}
                >
                  <AppText
                    variant="caption"
                    className={
                      optionSelected
                        ? 'text-white'
                        : 'text-onboarding-muted tabular-nums'
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
      <View className="flex-row justify-between gap-3">
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
