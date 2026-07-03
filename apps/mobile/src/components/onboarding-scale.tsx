import { Fragment } from 'react';
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
      <View className="min-h-[104px] justify-center">
        <AppText
          variant="caption"
          className="text-center text-onboarding-muted uppercase tracking-[1.5px]"
        >
          Selected
        </AppText>
        <AppText
          variant="title"
          className="mt-2 text-center text-onboarding-text"
        >
          {selected.label}
        </AppText>
        <AppText className="mt-2 text-center text-onboarding-muted leading-5">
          {selected.description}
        </AppText>
      </View>
      <View className="pb-2">
        <View className="flex-row items-center">
          {options.map((option, index) => {
            const optionSelected = option.value === value;

            return (
              <Fragment key={option.value}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: optionSelected }}
                  className="h-12 w-12 items-center justify-center"
                  hitSlop={8}
                  onPress={() => onChange(option.value)}
                >
                  <View
                    className={`h-12 w-12 items-center justify-center rounded-full ${
                      optionSelected
                        ? 'bg-onboarding-text'
                        : 'bg-onboarding-surface-muted'
                    }`}
                  >
                    <AppText
                      variant="label"
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
                {index === options.length - 1 ? null : (
                  <View
                    className={`mx-1 h-1.5 flex-1 rounded-full ${
                      index < selectedIndex
                        ? 'bg-onboarding-text'
                        : 'bg-onboarding-line'
                    }`}
                  />
                )}
              </Fragment>
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
