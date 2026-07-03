import { Pressable, View } from 'react-native';
import { AppText } from './app-text';

interface ChoiceDeckOption<T extends string> {
  value: T;
  label: string;
  description: string;
  meta?: string;
}

interface OnboardingChoiceDeckProps<T extends string> {
  options: readonly ChoiceDeckOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function OnboardingChoiceDeck<T extends string>({
  options,
  value,
  onChange,
}: OnboardingChoiceDeckProps<T>) {
  return (
    <View className="gap-3">
      {options.map((option, index) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`min-h-[78px] justify-center rounded-full px-5 py-4 active:opacity-75 ${
              selected ? 'bg-onboarding-surface' : 'bg-transparent'
            }`}
            onPress={() => onChange(option.value)}
          >
            <View className="flex-row items-center gap-4">
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  selected ? 'bg-onboarding-text' : 'bg-onboarding-surface'
                }`}
              >
                <AppText
                  variant="caption"
                  className={selected ? 'text-white' : 'text-onboarding-text'}
                >
                  {selected ? '✓' : String(index + 1)}
                </AppText>
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-start justify-between gap-3">
                  <AppText
                    variant="heading"
                    className="min-w-0 flex-1 text-onboarding-text"
                  >
                    {option.label}
                  </AppText>
                  {option.meta === undefined ? null : (
                    <AppText
                      variant="caption"
                      className="text-onboarding-muted"
                    >
                      {option.meta}
                    </AppText>
                  )}
                </View>
                <AppText className="mt-1.5 text-onboarding-muted leading-5">
                  {option.description}
                </AppText>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
