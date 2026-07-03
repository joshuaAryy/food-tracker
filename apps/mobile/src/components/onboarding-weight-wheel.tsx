import { useMemo } from 'react';
import { View } from 'react-native';
import { AppText } from './app-text';
import {
  OnboardingWheelColumn,
  valuesBetween,
  wheelItemHeight,
  wheelVerticalPadding,
} from './onboarding-wheel-column';

interface OnboardingWeightWheelProps {
  valueLb: number;
  label: string;
  referenceLb?: number | null;
  onChange: (valueLb: number) => void;
}

function clampWeight(value: number): number {
  return Math.min(Math.max(Math.round(value * 10) / 10, 70), 500);
}

function weightParts(value: number) {
  const clamped = clampWeight(value);
  const whole = Math.floor(clamped);
  const decimal = Math.round((clamped - whole) * 10);

  return { whole, decimal };
}

function formatDelta(valueLb: number, referenceLb?: number | null): string {
  if (referenceLb === undefined || referenceLb === null || referenceLb <= 0) {
    return 'Set your starting point';
  }

  const delta = Math.round((valueLb - referenceLb) * 10) / 10;

  if (delta === 0) {
    return 'Matches your current weight';
  }

  return `${Math.abs(delta).toFixed(1)} lb ${
    delta > 0 ? 'above' : 'below'
  } current`;
}

export function OnboardingWeightWheel({
  valueLb,
  label,
  referenceLb,
  onChange,
}: OnboardingWeightWheelProps) {
  const clampedValue = clampWeight(valueLb);
  const { whole, decimal } = weightParts(clampedValue);
  const wholeValues = useMemo(() => valuesBetween(70, 500), []);
  const decimalValues = useMemo(() => valuesBetween(0, 9), []);

  const selectWeight = (nextWhole: number, nextDecimal: number) => {
    onChange(clampWeight(nextWhole + nextDecimal / 10));
  };

  return (
    <View className="gap-8">
      <View className="items-center gap-2">
        <AppText
          variant="caption"
          className="text-onboarding-muted uppercase tracking-[1.3px]"
        >
          {label}
        </AppText>
        <View className="flex-row items-end gap-2">
          <AppText
            variant="display"
            className="text-onboarding-text tabular-nums"
          >
            {clampedValue.toFixed(1)}
          </AppText>
          <AppText variant="label" className="pb-2 text-onboarding-muted">
            lb
          </AppText>
        </View>
        <AppText className="text-center text-onboarding-muted">
          {formatDelta(clampedValue, referenceLb)}
        </AppText>
      </View>

      <View className="relative">
        <View
          className="absolute left-0 right-0 rounded-full bg-onboarding-surface-muted"
          style={{
            height: wheelItemHeight,
            top: wheelVerticalPadding,
          }}
        />
        <View className="flex-row items-center px-9">
          <OnboardingWheelColumn
            accessibilityLabel={`${label} pounds`}
            values={wholeValues}
            selectedValue={whole}
            labelForValue={(value) => String(value)}
            onSelect={(nextWhole) => selectWeight(nextWhole, decimal)}
          />
          <View className="h-12 w-6 items-center justify-center">
            <AppText variant="heading" className="text-onboarding-text">
              .
            </AppText>
          </View>
          <OnboardingWheelColumn
            accessibilityLabel={`${label} tenths`}
            values={decimalValues}
            selectedValue={decimal}
            labelForValue={(value) => String(value)}
            onSelect={(nextDecimal) => selectWeight(whole, nextDecimal)}
          />
          <View className="h-12 w-12 items-center justify-center">
            <AppText variant="heading" className="text-onboarding-text">
              lb
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}
