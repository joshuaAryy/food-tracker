import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import {
  autoSavedViewName,
  savedViewInputFromTrend,
  trendQueryFromRouteParam,
} from '@/lib/analytics/saved-view-configuration';

export default function SaveViewScreen() {
  const router = useRouter();
  const { query: rawQuery } = useLocalSearchParams<{ query?: string }>();
  const trend = useMemo(() => trendQueryFromRouteParam(rawQuery), [rawQuery]);
  const [name, setName] = useState(() =>
    trend === null
      ? ''
      : autoSavedViewName({
          primaryMetric: trend.primaryMetric,
          comparisonMetric: trend.comparisonMetric,
          periodDays: trend.period.kind === 'relative' ? trend.period.days : 0,
        }),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/trends/saved-views' as never);
  };

  const save = async () => {
    if (trend === null) return;
    setSaving(true);
    setError(null);
    try {
      await api.analytics.createSavedView(savedViewInputFromTrend(trend, name));
      router.replace('/trends/saved-views' as never);
    } catch (cause) {
      setError(errorMessage(cause));
      setSaving(false);
    }
  };

  if (trend === null) {
    return (
      <AppScreen>
        <ErrorState
          title="Saved view is unavailable"
          message="This Trend configuration could not be restored."
          onRetry={close}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      contentClassName="gap-6 pb-8"
      footer={
        <AppButton loading={saving} onPress={() => void save()}>
          Save view
        </AppButton>
      }
    >
      <ScreenHeader
        title="Save view"
        subtitle="Saved periods stay relative as your history grows."
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={close}
          >
            <AppText variant="label">Close</AppText>
          </Pressable>
        }
      />
      {error === null ? null : (
        <ErrorState message={error} onRetry={() => void save()} />
      )}
      <View className="gap-2 rounded-app bg-module p-4">
        <AppText variant="label">{trend.primaryMetric}</AppText>
        <AppText muted>
          {trend.period.kind === 'relative'
            ? `${trend.period.days}D rolling period`
            : 'Rolling period'}
        </AppText>
      </View>
      <AppInput
        label="View name"
        value={name}
        maxLength={80}
        onChangeText={setName}
        accessibilityLabel="View name"
      />
    </AppScreen>
  );
}
