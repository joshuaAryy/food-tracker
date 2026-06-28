import { View } from 'react-native';
import type { TrackingMode } from '@food-tracker/shared';
import { AppText } from './app-text';

const darkPrimaryText = '#F7F7F4';
const darkSecondaryText = '#C9CCC4';
const darkTertiaryText = '#A8ADA2';

interface OnboardingPlanPreviewProps {
  calories: string;
  protein: string;
  mode: TrackingMode;
}

function PreviewBar({
  label,
  value,
  widthClassName,
}: {
  label: string;
  value: string;
  widthClassName: string;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <AppText
          variant="caption"
          className="text-white"
          style={{ color: darkTertiaryText }}
        >
          {label}
        </AppText>
        <AppText
          variant="caption"
          className="text-white"
          style={{ color: darkSecondaryText }}
        >
          {value}
        </AppText>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-white/12">
        <View className={`h-full rounded-full bg-white ${widthClassName}`} />
      </View>
    </View>
  );
}

export function OnboardingPlanPreview({
  calories,
  protein,
  mode,
}: OnboardingPlanPreviewProps) {
  return (
    <View className="overflow-hidden rounded-[30px] bg-onboarding-text">
      <View className="px-5 pb-4 pt-5">
        <View className="flex-row items-start justify-between gap-4">
          <View className="min-w-0 flex-1">
            <AppText
              variant="caption"
              className="text-white uppercase tracking-[1px]"
              style={{ color: darkTertiaryText }}
            >
              Starting plan
            </AppText>
            <AppText
              className="mt-2 text-white leading-5"
              style={{ color: darkSecondaryText }}
            >
              A first look at the daily targets that will anchor Progress.
            </AppText>
          </View>
          <View className="rounded-full border border-white/15 px-3 py-1">
            <AppText
              variant="caption"
              className="text-white"
              style={{ color: darkSecondaryText }}
            >
              {mode === 'simple' ? 'Simple' : 'Detailed'}
            </AppText>
          </View>
        </View>
        <View className="mt-7">
          <AppText className="text-white" style={{ color: darkSecondaryText }}>
            Daily energy
          </AppText>
          <View className="mt-1 flex-row items-end gap-2">
            <AppText
              variant="display"
              className="text-white text-[48px] leading-[52px]"
              style={{ color: darkPrimaryText }}
            >
              {calories}
            </AppText>
            <AppText
              variant="label"
              className="pb-2 text-white"
              style={{ color: darkSecondaryText }}
            >
              kcal
            </AppText>
          </View>
        </View>
      </View>
      <View className="gap-4 border-t border-white/12 px-5 py-5">
        <PreviewBar
          label="Protein"
          value={`${protein} g`}
          widthClassName="w-[62%]"
        />
        <PreviewBar
          label="Tracking detail"
          value={mode === 'simple' ? 'Core' : 'Full'}
          widthClassName="w-[48%]"
        />
      </View>
    </View>
  );
}
