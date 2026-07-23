import { View } from 'react-native';
import type { TrackingMode } from '@food-tracker/shared';
import { AppText } from './app-text';
import { trackingModeLabel } from '@/lib/reporting-ui';

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
        <AppText variant="caption" className="text-onboarding-muted">
          {label}
        </AppText>
        <AppText variant="caption" className="text-onboarding-muted">
          {value}
        </AppText>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-onboarding-line">
        <View
          className={`h-full rounded-full bg-onboarding-text ${widthClassName}`}
        />
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
    <View className="gap-6 rounded-[38px] bg-onboarding-surface px-6 py-6">
      <View className="flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1">
          <AppText
            variant="caption"
            className="text-onboarding-muted uppercase tracking-[1.5px]"
          >
            Starting plan
          </AppText>
          <AppText className="mt-2 text-onboarding-muted leading-5">
            A first set of targets to anchor your Progress screen.
          </AppText>
        </View>
        <View className="rounded-full bg-onboarding-surface-muted px-3 py-1">
          <AppText variant="caption" className="text-onboarding-text">
            {trackingModeLabel(mode)}
          </AppText>
        </View>
      </View>
      <View>
        <AppText className="text-onboarding-muted">Daily energy</AppText>
        <View className="mt-1 flex-row items-end gap-2">
          <AppText
            variant="display"
            className="text-onboarding-text text-[56px] leading-[60px]"
          >
            {calories}
          </AppText>
          <AppText variant="label" className="pb-2 text-onboarding-muted">
            kcal
          </AppText>
        </View>
      </View>
      <View className="gap-4">
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
