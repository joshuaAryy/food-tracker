import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import {
  applyTrendDraft,
  createTrendDraft,
  updateTrendDraft,
} from '@/lib/analytics/trend-config';
import {
  trendQueryFromRouteParam,
  trendQueryRouteParam,
} from '@/lib/analytics/saved-view-configuration';

const coverageOptions = [
  ['all_logged_days', 'All recorded days'],
  ['complete_and_partial', 'Complete + partial'],
  ['complete_only', 'Complete days only'],
] as const;

export default function ConfigureTrendScreen() {
  const router = useRouter();
  const { query: rawQuery } = useLocalSearchParams<{ query?: string }>();
  const active = useMemo(() => trendQueryFromRouteParam(rawQuery), [rawQuery]);
  const [draft, setDraft] = useState(() =>
    active === null ? null : createTrendDraft(active),
  );
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/trends/calories' as never);
  };
  if (active === null || draft === null) {
    return (
      <AppScreen>
        <ErrorState
          title="Trend configuration is unavailable"
          message="This Trend could not be configured."
          onRetry={close}
        />
      </AppScreen>
    );
  }
  const apply = () => {
    const query = applyTrendDraft(active, draft);
    router.replace({
      pathname: '/trends/[metric]',
      params: {
        metric: query.primaryMetric,
        query: trendQueryRouteParam(query),
      },
    } as never);
  };
  return (
    <AppScreen
      contentClassName="gap-6 pb-8"
      footer={<AppButton onPress={apply}>Apply changes</AppButton>}
    >
      <ScreenHeader
        title="Configure Trend"
        subtitle="Changes stay temporary until you save a view."
        action={
          <Pressable onPress={close}>
            <AppText variant="label">Close</AppText>
          </Pressable>
        }
      />
      <View className="gap-2">
        <AppText variant="label">Data coverage</AppText>
        {coverageOptions.map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: draft.coverageFilter === value }}
            className={`min-h-11 rounded-app px-4 py-3 ${draft.coverageFilter === value ? 'bg-ink' : 'bg-module'}`}
            onPress={() =>
              setDraft(updateTrendDraft(draft, { coverageFilter: value }))
            }
          >
            <AppText
              className={
                draft.coverageFilter === value ? 'text-white' : 'text-ink'
              }
            >
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: draft.showReference }}
        className="min-h-11 rounded-app bg-module px-4 py-3"
        onPress={() =>
          setDraft(
            updateTrendDraft(draft, { showReference: !draft.showReference }),
          )
        }
      >
        <AppText variant="label">Show target or reference</AppText>
      </Pressable>
    </AppScreen>
  );
}
