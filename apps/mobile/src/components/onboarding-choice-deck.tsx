import { Pressable, View } from 'react-native';
import { AppText } from './app-text';

const darkPrimaryText = '#F7F7F4';
const darkSecondaryText = '#C9CCC4';
const darkTertiaryText = '#A8ADA2';

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
            className={`min-h-[108px] rounded-[28px] border px-4 py-4 active:opacity-75 ${
              selected
                ? 'border-onboarding-text bg-onboarding-text'
                : 'border-onboarding-line bg-onboarding-surface'
            }`}
            onPress={() => onChange(option.value)}
          >
            <View className="flex-row items-start gap-4">
              <View
                className={`h-9 w-9 items-center justify-center rounded-full border ${
                  selected
                    ? 'border-white/25 bg-white/10'
                    : 'border-onboarding-line bg-onboarding-surface-muted'
                }`}
              >
                <AppText
                  variant="label"
                  className={selected ? 'text-white' : 'text-onboarding-text'}
                  style={selected ? { color: darkPrimaryText } : undefined}
                >
                  {String(index + 1).padStart(2, '0')}
                </AppText>
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-start justify-between gap-3">
                  <AppText
                    variant="heading"
                    className={selected ? 'text-white' : 'text-onboarding-text'}
                    style={selected ? { color: darkPrimaryText } : undefined}
                  >
                    {option.label}
                  </AppText>
                  {option.meta === undefined ? null : (
                    <AppText
                      variant="caption"
                      className={
                        selected ? 'text-white' : 'text-onboarding-muted'
                      }
                      style={selected ? { color: darkTertiaryText } : undefined}
                    >
                      {option.meta}
                    </AppText>
                  )}
                </View>
                <AppText
                  className={`mt-2 leading-5 ${selected ? 'text-white' : 'text-onboarding-muted'}`}
                  style={selected ? { color: darkSecondaryText } : undefined}
                >
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
