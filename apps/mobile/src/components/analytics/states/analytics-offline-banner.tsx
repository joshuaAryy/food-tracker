import { View } from 'react-native';
import { AppText } from '@/components/app-text';

export function AnalyticsOfflineBanner({
  cachedAt,
}: {
  cachedAt: number | null;
}) {
  const timestamp =
    cachedAt === null
      ? null
      : new Date(cachedAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        });
  return (
    <View
      testID="analytics-offline-banner"
      className="gap-1 rounded-[18px] border border-border bg-module p-4"
    >
      <AppText variant="label">Offline · Showing saved analytics</AppText>
      <AppText variant="caption" className="text-muted">
        {timestamp === null
          ? 'Your last committed analytics remain available.'
          : `Saved at ${timestamp}. Your last committed analytics remain available.`}
      </AppText>
    </View>
  );
}
