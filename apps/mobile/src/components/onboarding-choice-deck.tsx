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
    <View className="overflow-hidden rounded-[28px] bg-onboarding-surface shadow-sm">
      {options.map((option, index) => {
        const selected = option.value === value;
        const last = index === options.length - 1;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`min-h-[98px] px-4 py-4 active:opacity-75 ${
              selected ? 'bg-onboarding-accent-soft' : 'bg-onboarding-surface'
            } ${last ? '' : 'border-b border-onboarding-line'}`}
            onPress={() => onChange(option.value)}
          >
            <View className="flex-row items-start gap-4">
              <View
                className={`mt-1 h-10 w-[3px] rounded-full ${
                  selected ? 'bg-onboarding-text' : 'bg-onboarding-line'
                }`}
              />
              <View
                className={`h-9 w-9 items-center justify-center rounded-full ${
                  selected
                    ? 'bg-onboarding-text'
                    : 'bg-onboarding-surface-muted'
                }`}
              >
                <AppText
                  variant="label"
                  className={selected ? 'text-white' : 'text-onboarding-text'}
                >
                  {String(index + 1).padStart(2, '0')}
                </AppText>
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-start justify-between gap-3">
                  <AppText variant="heading" className="text-onboarding-text">
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
                <AppText className="mt-2 text-onboarding-muted leading-5">
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
