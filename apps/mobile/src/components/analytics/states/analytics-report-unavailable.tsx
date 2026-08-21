import { View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { AppScreen } from '@/components/app-screen';

export function AnalyticsReportUnavailable({
  period = 'month',
  onRetry,
}: {
  period?: 'week' | 'month';
  onRetry: () => void;
}) {
  return (
    <AppScreen
      testID="analytics-report-unavailable"
      contentClassName="gap-4"
      backgroundColor="#FFFFFF"
    >
      <AppText variant="title">Insights</AppText>
      <AppText variant="caption" className="text-muted">
        {period === 'week' ? 'Week' : 'Month'} · Unable to load
      </AppText>
      <View className="h-14" />
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-[#FBE7E7]">
          <AppText variant="heading" className="text-[#EB1226]">
            !
          </AppText>
        </View>
        <AppText variant="caption" className="font-bold text-[#EB1226]">
          ANALYTICS ERROR
        </AppText>
      </View>
      <AppText variant="heading" className="text-[26px] leading-8">
        Analytics unavailable
      </AppText>
      <AppText className="text-muted">
        We couldn’t load a valid analytics snapshot. Your food, weight, and
        water logs are safe and unchanged.
      </AppText>
      <AppButton
        accessibilityLabel="Retry analytics"
        className="rounded-[16px]"
        onPress={onRetry}
      >
        Retry
      </AppButton>
      <View className="gap-1 rounded-[16px] border border-border bg-[#F9F9F7] p-4">
        <AppText variant="label">Logging is still available</AppText>
        <AppText variant="caption" className="text-muted">
          You can continue logging food, weight, and water while analytics
          reconnects.
        </AppText>
      </View>
    </AppScreen>
  );
}
