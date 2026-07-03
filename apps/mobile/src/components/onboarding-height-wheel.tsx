import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from './app-text';
import {
  OnboardingWheelColumn,
  valuesBetween,
  wheelItemHeight,
  wheelVerticalPadding,
} from './onboarding-wheel-column';

export type HeightUnit = 'imperial' | 'metric';

interface OnboardingHeightWheelProps {
  heightInches: number;
  unit: HeightUnit;
  onUnitChange: (unit: HeightUnit) => void;
  onHeightInchesChange: (heightInches: number) => void;
}

function clampHeightInches(value: number): number {
  return Math.min(Math.max(Math.round(value), 36), 107);
}

function inchesToCentimeters(inches: number): number {
  return Math.round(inches * 2.54);
}

function centimetersToInches(centimeters: number): number {
  return clampHeightInches(Math.round(centimeters / 2.54));
}

export function OnboardingHeightWheel({
  heightInches,
  unit,
  onUnitChange,
  onHeightInchesChange,
}: OnboardingHeightWheelProps) {
  const clampedHeight = clampHeightInches(heightInches);
  const feet = Math.floor(clampedHeight / 12);
  const inches = clampedHeight % 12;
  const centimeters = inchesToCentimeters(clampedHeight);
  const footValues = useMemo(() => valuesBetween(3, 8), []);
  const inchValues = useMemo(() => valuesBetween(0, 11), []);
  const centimeterValues = useMemo(() => valuesBetween(91, 272), []);

  const selectImperial = (nextFeet: number, nextInches: number) => {
    onHeightInchesChange(clampHeightInches(nextFeet * 12 + nextInches));
  };

  return (
    <View className="gap-8">
      <View className="self-center rounded-full bg-onboarding-surface-muted p-1">
        <View className="flex-row">
          {(['imperial', 'metric'] as const).map((nextUnit) => {
            const selected = unit === nextUnit;

            return (
              <Pressable
                key={nextUnit}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`min-h-[48px] min-w-[118px] items-center justify-center rounded-full px-5 ${
                  selected ? 'bg-onboarding-surface' : 'bg-transparent'
                }`}
                onPress={() => onUnitChange(nextUnit)}
              >
                <AppText
                  variant="label"
                  className={
                    selected ? 'text-onboarding-text' : 'text-onboarding-muted'
                  }
                >
                  {nextUnit === 'imperial' ? 'ft, in' : 'cm'}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="relative">
        <View
          className="absolute left-0 right-0 rounded-full bg-onboarding-surface"
          style={{
            height: wheelItemHeight,
            top: wheelVerticalPadding,
          }}
        />
        {unit === 'imperial' ? (
          <View className="flex-row gap-2 px-6">
            <OnboardingWheelColumn
              accessibilityLabel="Height feet"
              values={footValues}
              selectedValue={feet}
              labelForValue={(value) => `${value} ft`}
              onSelect={(nextFeet) => selectImperial(nextFeet, inches)}
            />
            <OnboardingWheelColumn
              accessibilityLabel="Height inches"
              values={inchValues}
              selectedValue={inches}
              labelForValue={(value) => `${value} in`}
              onSelect={(nextInches) => selectImperial(feet, nextInches)}
            />
          </View>
        ) : (
          <View className="px-16">
            <OnboardingWheelColumn
              accessibilityLabel="Height centimeters"
              values={centimeterValues}
              selectedValue={centimeters}
              labelForValue={(value) => `${value} cm`}
              onSelect={(nextCentimeters) =>
                onHeightInchesChange(centimetersToInches(nextCentimeters))
              }
            />
          </View>
        )}
      </View>

      <View className="items-center gap-1">
        <AppText
          variant="caption"
          className="text-onboarding-muted uppercase tracking-[1.3px]"
        >
          Saved height
        </AppText>
        <AppText variant="heading" className="text-onboarding-text">
          {feet} ft {inches} in · {centimeters} cm
        </AppText>
      </View>
    </View>
  );
}
